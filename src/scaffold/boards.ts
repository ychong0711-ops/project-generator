import type { Project } from '../types';
import type { BoardId, BoardSpec } from './types';
import { familyOf } from './families';

/* ============================================================
 *  보드 정의 — STM32F103(BluePill) / STM32F407-Discovery / host(POSIX)
 *  벤더 SDK 의존 없이 startup + 링커 + 레지스터 접근만으로 자족적으로 빌드한다.
 * ============================================================ */

const STARTUP_TEMPLATE = (cpu: string) => String.raw`.syntax unified
.cpu ${cpu}
.thumb

.global g_pfnVectors
.global Reset_Handler

.section .isr_vector,"a",%progbits
g_pfnVectors:
    .word _estack
    .word Reset_Handler
    .word Default_Handler   @ NMI
    .word Default_Handler   @ HardFault
    .word Default_Handler   @ MemManage
    .word Default_Handler   @ BusFault
    .word Default_Handler   @ UsageFault
    .word 0
    .word 0
    .word 0
    .word 0
    .word Default_Handler   @ SVCall
    .word Default_Handler   @ DebugMonitor
    .word 0
    .word Default_Handler   @ PendSV
    .word Default_Handler   @ SysTick
    .rept 60
    .word Default_Handler   @ peripheral IRQs
    .endr

.section .text.Reset_Handler
.weak Reset_Handler
.type Reset_Handler, %function
Reset_Handler:
    /* copy .data from FLASH to RAM */
    ldr r0, =_sdata
    ldr r1, =_edata
    ldr r2, =_sidata
data_copy:
    cmp r0, r1
    ittt lt
    ldrlt r3, [r2], #4
    strlt r3, [r0], #4
    blt data_copy

    /* zero .bss */
    ldr r0, =_sbss
    ldr r1, =_ebss
    movs r3, #0
bss_zero:
    cmp r0, r1
    it lt
    strlt r3, [r0], #4
    blt bss_zero

    bl SystemInit
    bl main
hang:
    b hang

.size Reset_Handler, . - Reset_Handler

.section .text.Default_Handler,"ax",%progbits
Default_Handler:
    b Default_Handler
`;

const ldTemplate = (flash: string, ram: string, comment: string) => String.raw`/* ${comment} */
ENTRY(Reset_Handler)

MEMORY
{
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = ${flash}
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = ${ram}
}

_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
    .isr_vector :
    {
        KEEP(*(.isr_vector))
    } > FLASH

    .text :
    {
        *(.text*)
        *(.rodata*)
        . = ALIGN(4);
        _etext = .;
    } > FLASH

    _sidata = LOADADDR(.data);

    .data :
    {
        . = ALIGN(4);
        _sdata = .;
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT> FLASH

    .bss :
    {
        . = ALIGN(4);
        _sbss = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
    } > RAM
}
`;

/* ---------- STM32F103 (Cortex-M3) ---------- */
const BOARD_C_F103 = String.raw`/* board_arm.c — STM32F103 (Cortex-M3) 최소 레지스터 구현 (벤더 SDK 무의존) */
#include "board.h"
#include <stdint.h>

typedef struct {
    volatile uint32_t CRL, CRH, IDR, ODR, BSRR, BRR, LCKR;
} gpio_regs_t;

typedef struct {
    volatile uint32_t CR, CFGR, CIR, APB2RSTR, APB1RSTR;
    volatile uint32_t AHBENR, APB2ENR, APB1ENR, BDCR, CSR;
} rcc_regs_t;

#define RCC   ((rcc_regs_t *)0x40021000u)
#define GPIOC ((gpio_regs_t *)0x40011000u)

static volatile uint32_t g_ms;

void board_init(void)
{
    RCC->APB2ENR |= (1u << 4);        /* GPIOC clock enable */
    GPIOC->CRH &= ~(0xFu << 20);      /* PC13 output push-pull 2MHz (BluePill LED) */
    GPIOC->CRH |=  (0x2u << 20);
    GPIOC->BSRR = (1u << 13);
    g_ms = 0u;
}

uint32_t board_millis(void)
{
    return g_ms;
}

void board_delay_ms(uint32_t ms)
{
    volatile uint32_t i;
    for (i = 0u; i < ms * 8000u; ++i) {
        /* spin */
    }
    g_ms += ms;
}

void board_led_toggle(void)
{
    GPIOC->ODR ^= (1u << 13);
}

void board_log(const char *msg)
{
    (void)msg;   /* TODO: UART/SWO */
}
`;

/* ---------- STM32F407 (Cortex-M4) ---------- */
const BOARD_C_F407 = String.raw`/* board_arm.c — STM32F407 (Cortex-M4) 최소 레지스터 구현 (벤더 SDK 무의존) */
#include "board.h"
#include <stdint.h>

typedef struct {
    volatile uint32_t MODER, OTYPER, OSPEEDR, PUPDR, IDR, ODR, BSRR;
} gpio_regs_t;

typedef struct {
    volatile uint32_t CR, PLLCFGR, CFGR, CIR, AHB1RSTR, AHB2RSTR, AHB3RSTR, r0;
    volatile uint32_t APB1RSTR, APB2RSTR, r1, r2;
    volatile uint32_t AHB1ENR, AHB2ENR, AHB3ENR;
} rcc_regs_t;

#define RCC   ((rcc_regs_t *)0x40023800u)
#define GPIOD ((gpio_regs_t *)0x40020C00u)

static volatile uint32_t g_ms;

void board_init(void)
{
    RCC->AHB1ENR |= (1u << 3);        /* GPIOD clock enable */
    GPIOD->MODER &= ~(0x3u << 24);    /* PD12 output (green LED) */
    GPIOD->MODER |=  (0x1u << 24);
    GPIOD->BSRR = (1u << (12 + 16));  /* LED off */
    g_ms = 0u;
}

uint32_t board_millis(void)
{
    return g_ms;
}

void board_delay_ms(uint32_t ms)
{
    volatile uint32_t i;
    for (i = 0u; i < ms * 16000u; ++i) {
        /* spin */
    }
    g_ms += ms;
}

void board_led_toggle(void)
{
    GPIOD->ODR ^= (1u << 12);
}

void board_log(const char *msg)
{
    (void)msg;   /* TODO: UART/SWO */
}
`;

const SYSTEM_C = String.raw`/* system_*.c — 최소 시스템 초기화 (실제 포트에서는 클럭 트리 설정) */
void SystemInit(void)
{
    /* no-op (기본 HSI) */
}
`;

export const BOARD_SPECS: Record<BoardId, BoardSpec> = {
  'bluepill-f103': {
    id: 'bluepill-f103',
    label: 'STM32F103C8 BluePill',
    isHost: false,
    mcuDefine: 'STM32F103xB',
    cpu: 'cortex-m3',
    ldName: 'stm32f103.ld',
    ld: ldTemplate('64K', '20K', 'STM32F103C8 — BluePill: 64K FLASH, 20K RAM'),
    startupName: 'startup_stm32f103.s',
    startup: STARTUP_TEMPLATE('cortex-m3'),
    boardCName: 'board_arm.c',
    boardC: BOARD_C_F103,
    systemCName: 'system_stm32f1.c',
    systemC: SYSTEM_C,
  },
  'stm32f407-discovery': {
    id: 'stm32f407-discovery',
    label: 'STM32F407 Discovery',
    isHost: false,
    mcuDefine: 'STM32F407xx',
    cpu: 'cortex-m4',
    ldName: 'stm32f407.ld',
    ld: ldTemplate('1024K', '128K', 'STM32F407VG — Discovery: 1M FLASH, 128K RAM'),
    startupName: 'startup_stm32f407.s',
    startup: STARTUP_TEMPLATE('cortex-m4'),
    boardCName: 'board_arm.c',
    boardC: BOARD_C_F407,
    systemCName: 'system_stm32f4.c',
    systemC: SYSTEM_C,
  },
  host: {
    id: 'host',
    label: 'Host (POSIX)',
    isHost: true,
    mcuDefine: '',
    cpu: '',
    ldName: '',
    ld: '',
    startupName: '',
    startup: '',
    boardCName: '',
    boardC: '',
    systemCName: '',
    systemC: '',
  },
};

/**
 * 기본 보드를 도출한다 (D1).
 * - linux 패밀리(linux·adas·someip·sdv) → host
 * - `mcu[0]` 에 F103 → bluepill-f103
 * - 그 외 ARM → stm32f407-discovery (Cortex-M4 fallback)
 */
export function resolveBoard(project: Project, override?: BoardId): BoardId {
  if (override) return override;
  if (familyOf(project) === 'linux') return 'host';
  const primary = (project.mcu[0] ?? '').toUpperCase();
  if (primary.includes('F103')) return 'bluepill-f103';
  return 'stm32f407-discovery';
}
