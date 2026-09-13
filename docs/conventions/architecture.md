# 아키텍처

## 현재 기준 구조

```text
apps/web/         → 웹 사용자 인터페이스
apps/server/      → HTTP API와 향후 실시간 도메인 서버
packages/contracts/  → Zod 기반 HTTP·Socket.IO 런타임 계약
packages/types/      → web과 server가 함께 사용하는 타입
```

`apps/web`은 Next.js App Router로 빌드한다. `apps/server`는 NestJS 기반이며, HTTP API와 Socket.IO를 같은 도메인 경계 안에서 제공할 수 있다. 두 애플리케이션이 공유하는 타입은 `packages/types`에 둔다. 외부 입력을 검증하는 Zod 기반 런타임 계약은 `packages/contracts`에 둔다. 루트 Turborepo 명령으로 각 workspace의 빌드·lint·타입 검사·테스트를 함께 실행한다.

현재 서버의 최소 운영 확인 경로는 `GET /health`이며, `HealthResponse` 타입을 `packages/types`에서 가져온다. 이 경로는 인증이나 데이터베이스 연결을 요구하지 않는다.

## 목표 구조

웹 서비스는 Next.js와 TypeScript로 운영한다. 공개 콘텐츠와 로그인 후 앱은 렌더링·배포 전략을 분리할 수 있으며, 인증·매칭·채팅은 NestJS 서버와 통신한다. 현재 `apps/web`은 Next.js 전환의 기반만 갖춘 상태이므로, 기능 화면과 API 연결은 이 기반 위에서 단계적으로 구현한다.

React Native 앱은 별도 `mobile` 프로젝트에서 웹 앱을 WebView로 표시한다. 모바일 전용 기능이 필요해질 때만 네이티브 브리지를 추가한다.

## 도입 원칙

- Supabase PostgreSQL은 영속 데이터의 기준 저장소로 사용한다.
- Redis는 다중 서버 환경의 매칭 대기열, Socket.IO 어댑터, 원자적 동시성 제어가 실제로 필요해진 뒤 도입한다.
- Socket.IO 이벤트와 HTTP 요청·응답 타입은 구현 전에 `packages/types`에 정의하고, 외부 입력을 확인하는 Zod 스키마는 `packages/contracts`에 정의한다.
- Next.js 전환 전후의 초기 로딩과 검색 노출 성과를 측정해, 전환 효과와 추가 개선 항목을 확인한다.
