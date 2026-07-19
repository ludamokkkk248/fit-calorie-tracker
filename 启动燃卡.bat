@echo off
chcp 65001 >nul
cd /d "%~dp0"
title FitCal Server
echo.
echo  ============================================
echo   燃卡 FitCal 正在启动...
echo   浏览器将自动打开 http://localhost:8137
echo   使用期间请不要关闭本窗口
echo   (安装成桌面App后, 以后不开这个窗口也能用)
echo  ============================================
echo.
start "" "http://localhost:8137"
python -m http.server 8137
if errorlevel 1 (
  echo.
  echo  启动失败: 可能端口被占用, 或电脑上没有安装 Python
  echo  可以把这个文件发给帮你安装的人看看
  pause
)
