@echo off
echo Killing all processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Clearing caches...
cd client
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist dist rmdir /s /q dist
if exist .vite rmdir /s /q .vite
cd ..

echo Starting server...
start "Server" cmd /c "npm start"

timeout /t 2 /nobreak >nul

echo Starting client...
cd client
start "Client" cmd /c "npm run dev"
cd ..

timeout /t 3 /nobreak >nul

echo.
echo Servers started!
echo Check the Server and Client windows for status.



