---
name: review-receipt
description: 파일을 수정하거나 명령을 실행한 Codex 작업의 프롬프트, 변경 파일, 검증 명령을 영수증으로 남긴다.
---

# 작업 변경 영수증

Codex 훅이 프롬프트, `Bash`, `apply_patch` 호출을 기록하고 작업 종료 시 프로젝트 루트의 `.agent_history.md`를 갱신한다.

파일을 수정하는 작업에서는 최종 답변 전에 영수증이 생성됐는지 확인한다. 훅이 실패하거나 신뢰되지 않은 경우에는 최종 답변에 그 사실을 알리고, 수동으로 `node .codex/hooks/review_receipt.mjs finalize`를 실행한다.

영수증에는 비밀값을 쓰지 않는다. 명령과 프롬프트에 비밀값이 포함될 수 있으면 `[REDACTED]`로 바꾼다.
