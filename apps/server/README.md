# 서버

NestJS 기반 텔레파시 API·실시간 서버다. 현재 확인용 HTTP 경로는 `GET /health`다.

루트에서 다음 명령을 사용한다.

```bash
npm run start:dev --workspace=@telepathy/server
npm run test --workspace=@telepathy/server
```

구조와 다음 구현 순서는 [루트 아키텍처 문서](../docs/conventions/architecture.md)를 따른다.
