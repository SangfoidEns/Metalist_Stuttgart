# Портативний Windows ZIP

Збірка:

```bat
cd windows-server
npm install
npm run pack:win
```

Результат: `dist/STGmetal-Server-win32-x64/` — запакуйте в ZIP.

Користувач:

1. Розпаковує ZIP
2. Запускає `STGmetal-Server.exe`
3. Керує сервером, папкою даних і міграцією JSON у вікні

Node.js / npm на ПК **не потрібні**.
