@echo off
setlocal
chcp 65001 >nul
REM ============================================================
REM  AutoEmbed LAB - 전체 검증 실행 스크립트
REM  Node.js 20+ 필요 (권장 22, CI와 동일)
REM
REM  주의: 이 파일은 UTF-8(BOM 없음) + CRLF 로 저장해야 합니다.
REM        BOM 이 있으면 cmd.exe 가 첫 줄을 깨진 명령으로 인식하고,
REM        LF 만 있으면 괄호 블록이 오작동합니다.
REM ============================================================

echo ========================================
echo  AutoEmbed LAB - 전체 검증 스크립트
echo ========================================
echo.

REM ---------- 0. Node.js / npm 확인 ----------
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm 을 찾을 수 없습니다. Node.js 20+ 를 설치하세요.
    echo         https://nodejs.org
    goto :fail
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODEVER=%%v"
echo  Node.js %NODEVER%
echo.

REM ---------- 1. 의존성 설치 ----------
echo [1/4] 의존성 설치 중...
if exist "package-lock.json" (
    REM lockfile 이 있으면 재현 가능한 설치(npm ci)를 우선 사용
    call npm ci
    if errorlevel 1 (
        echo.
        echo [WARN] npm ci 실패 - npm install 로 재시도합니다.
        echo        ^(lockfile 과 package.json 이 어긋났을 수 있습니다^)
        call npm install
        if errorlevel 1 goto :fail_install
    )
) else (
    call npm install
    if errorlevel 1 goto :fail_install
)
echo.

REM ---------- 2. 타입 체크 ----------
echo [2/4] TypeScript 타입 체크 중...
call npm run typecheck
if errorlevel 1 (
    echo.
    echo [ERROR] 타입 체크 실패
    goto :fail
)
echo.

REM ---------- 3. 테스트 ----------
echo [3/4] 테스트 실행 중...
call npm test
if errorlevel 1 (
    echo.
    echo [ERROR] 테스트 실패
    goto :fail
)
echo.

REM ---------- 4. 프로덕션 빌드 ----------
echo [4/4] 프로덕션 빌드 중...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] 빌드 실패
    goto :fail
)
echo.

echo ========================================
echo  모든 단계 완료
echo ========================================
echo.
echo  개발 서버 실행 : npm run dev
echo  빌드 결과물    : dist\index.html
echo.
pause
endlocal
exit /b 0

:fail_install
echo.
echo [ERROR] 의존성 설치 실패
echo         node_modules 폴더를 지우고 다시 시도해 보세요:
echo           rmdir /s /q node_modules
echo.
echo         peer 충돌이 나더라도 --force / --legacy-peer-deps 는
echo         사용하지 마세요. 깨진 의존성 트리가 만들어집니다.
goto :fail

:fail
echo.
pause
endlocal
exit /b 1
