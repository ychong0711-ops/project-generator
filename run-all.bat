@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
REM AutoEmbed LAB - 전체 실행 배치 파일
REM Node.js 20+ 필요

echo ========================================
echo AutoEmbed LAB - 전체 실행 스크립트
echo ========================================

REM 0. Node.js / npm 설치 여부 확인
where npm >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: npm을 찾을 수 없습니다. Node.js 20+ 설치 여부를 확인하세요.
    pause
    exit /b 1
)

REM 1. 의존성 설치
echo [1/4] 의존성 설치 중...
call npm install
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: npm install 실패
    pause
    exit /b 1
)

REM 2. 타입 체크 (TypeScript)
echo [2/4] TypeScript 타입 체크 중...
call npx --no-install tsc --noEmit
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: 타입 체크 실패 ^(tsc가 devDependencies에 설치되어 있는지 확인하세요^)
    pause
    exit /b 1
)

REM 3. 테스트 실행
echo [3/4] 테스트 실행 중...
call npm test
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: 테스트 실패
    pause
    exit /b 1
)

REM 4. 프로덕션 빌드
echo [4/4] 프로덕션 빌드 중...
call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: 빌드 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo 모든 단계 완료!
echo ========================================
echo.
echo 개발 서버 실행: npm run dev
echo 빌드 결과물: dist/ 폴더
pause
