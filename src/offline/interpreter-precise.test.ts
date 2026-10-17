import { describe, expect, it } from 'vitest';
import { runC } from './interpreter';

describe('CInterpreter - Precise Byte-Memory Engine', () => {
  it('engineMode가 precise로 정상 반환된다', () => {
    const r = runC('int main() { printf("ok"); return 0; }', { mode: 'precise' });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('ok');
    expect(r.engineMode).toBe('precise');
  });

  it('union 폭(width) 마스킹이 실제 C(Little-Endian)와 정확히 일치한다 (321 -> 65)', () => {
    const src = `
      #include <stdio.h>
      union U { int a; char b; };
      int main() {
        union U v;
        v.a = 321;
        printf("%d %d", v.a, v.b);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('321 65');
    // precise 모드에서는 근사 경고가 발생하지 않음
    expect(r.warnings).toBeUndefined();
  });

  it('union 바이트 오버레이 (CAN 프레임 바이트 패킹/언패킹)를 지원한다', () => {
    const src = `
      #include <stdio.h>
      union CAN_Msg {
        uint32_t raw;
        uint8_t bytes[4];
      };
      int main() {
        union CAN_Msg msg;
        msg.bytes[0] = 0x12;
        msg.bytes[1] = 0x34;
        msg.bytes[2] = 0x56;
        msg.bytes[3] = 0x78;
        printf("0x%08X", msg.raw);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('0x78563412');
  });

  it('union 부동소수점 비트 재해석(Float Type Punning: 1.0f -> 0x3F800000)을 지원한다', () => {
    const src = `
      #include <stdio.h>
      union FloatBitCast {
        float f;
        uint32_t i;
      };
      int main() {
        union FloatBitCast fc;
        fc.f = 1.0f;
        printf("0x%08X", fc.i);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('0x3F800000');
  });

  it('구조체 값 대입(Assignment) 시 바이트 레벨 복사가 수행된다', () => {
    const src = `
      #include <stdio.h>
      struct Point {
        int x;
        int y;
      };
      int main() {
        struct Point p1;
        struct Point p2;
        p1.x = 100;
        p1.y = 200;
        p2 = p1;
        p1.x = 999; // p1 변경이 p2에 영향 없어야 함
        printf("%d %d %d", p2.x, p2.y, p1.x);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('100 200 999');
  });

  it('중첩된 구조체 및 다양한 정수형 크기(uint16_t, uint8_t)를 정밀하게 지원한다', () => {
    const src = `
      #include <stdio.h>
      struct Header {
        uint8_t id;
        uint8_t status;
        uint16_t value;
      };
      union SensorPacket {
        struct Header fields;
        uint32_t raw;
      };
      int main() {
        union SensorPacket pkt;
        pkt.fields.id = 0x01;
        pkt.fields.status = 0x80;
        pkt.fields.value = 0x0203;
        printf("0x%08X", pkt.raw);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    // fields: id(0x01), status(0x80), value(0x0203 -> 0x03, 0x02) => raw: 0x02038001
    expect(r.output).toBe('0x02038001');
  });

  it('CAN 프레임 raw 정수 쓰기 후 바이트 배열로 Little-Endian 분해 읽기가 가능하다', () => {
    const src = `
      #include <stdio.h>
      union CAN {
        uint32_t raw;
        uint8_t b[4];
      };
      int main() {
        union CAN frame;
        frame.raw = 0xAABBCCDD;
        printf("%02X %02X %02X %02X", frame.b[0], frame.b[1], frame.b[2], frame.b[3]);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    // Little-Endian 순서: DD CC BB AA
    expect(r.output).toBe('DD CC BB AA');
  });

  it('uint8_t/int8_t 경계값(255 -> -1 vs 255) 및 정밀 오버플로우 마스킹을 지원한다', () => {
    const src = `
      #include <stdio.h>
      union SignTest {
        int8_t s;
        uint8_t u;
      };
      int main() {
        union SignTest st;
        st.u = 255;
        printf("%d %d", st.u, st.s);
        return 0;
      }
    `;
    const r = runC(src, { mode: 'precise' });
    expect(r.ok).toBe(true);
    // uint8_t 255는 int8_t로 -1
    expect(r.output).toBe('255 -1');
  });
});
