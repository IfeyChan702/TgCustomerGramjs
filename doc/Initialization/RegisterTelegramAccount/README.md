1) Go to https://my.telegram.org/auth
2) Enter Telephone Number. Click Next
3) Enter Confirmation code
4) Get App api_id and App api_hash
5) Go to PostMan
6) Post Request to (http://localhost:8080/api/tg/register/init). Enter App api_id and App api_hash as requestBody.
7) Get the registerId
8)  Post Request to (http://127.0.0.1:8080/api/tg/register/phone). Enter registerId and phone as requestBody.
9) Get the Code
10) Post Request to (http://127.0.0.1:8080/api/tg/register/code). Enter registerId and code as requestBody.