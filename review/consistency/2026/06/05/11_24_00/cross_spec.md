# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-done` (scope: `spec/5-system/`, diff-base: `origin/main`)
**검토 대상 변경 파일**:
- `spec/5-system/4-execution-engine.md` — `_resumeCheckpoint` `schemaVersion` 필드 추가
- `spec/5-system/3-error-handling.md` — `RESUME_INCOMPATIBLE_STATE` 에 "미래 버전" 케이스 추가
- `spec/5-system/6-websocket-protocol.md` — 동일
- `spec/4-nodes/3-ai/1-ai-agent.md` — 동일
- `spec/conventions/node-output.md` — 동일
- `spec/conventions/error-codes.md` — 초대 에러 코드 historical-artifact 레지스트리 등재
- `spec/5-system/1-auth.md` — 초대 에러 코드 historical-artifact 주석 추가

---

## 발견사항

### [INFO] `telegram.md` §5.7 `RESUME_INCOMPATIBLE_STATE` 발생 케이스 열거 미갱신
- **target 위치**: `spec/5-system/3-error-handling.md` L94 / `spec/5-system/4-execution-engine.md` §1.3·§7.5
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.7 L192
- **상세**: target 들이 `RESUME_INCOMPATIBLE_STATE` 의 트리거 케이스에 "**미래 버전**(`schemaVersion` 이 현재 코드 `CHECKPOINT_SCHEMA_VERSION` 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup)"을 추가했다. 그런데 `telegram.md` §5.7 마지막 문장은 "본 안내는 `ai_agent` 정상 재개가 동작하므로 실제로는 **배포 이전 진입한 waiting row / `information_extractor` / 손상 케이스**에서만 표시된다"로 케이스를 열거하고 있어, "미래 버전" 케이스가 누락된 채로 동기화되지 않았다.
- **제안**: `telegram.md` §5.7 L192 의 열거에 "미래 버전(`schemaVersion` 초과, 롤링 배포 중)" 를 추가해 동기화. 직접 모순은 아니지만(prose 열거이므로 작동 불가 수준은 아님) 미래 운영자가 오해할 수 있다.

---

### [INFO] `error-codes.md` historical-artifact 레지스트리에 등재된 `forbidden` / `rate_limited` (lowercase) 와 표준 `FORBIDDEN` / `RATE_LIMITED` (UPPER_SNAKE_CASE) 의 명시적 구분 충분성
- **target 위치**: `spec/conventions/error-codes.md` §3 (신규 행)
- **충돌 대상**: `spec/5-system/2-api-convention.md` L160 / `spec/5-system/3-error-handling.md` L28·L37
- **상세**: 표준 코드표에 `FORBIDDEN`(403)·`RATE_LIMITED`(429) 가 UPPER_SNAKE_CASE 로 정의되어 있고, 신규 레지스트리 행도 "**초대 API 한정** — 본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개다"라고 명기한다. 직접 모순은 아니며 레지스트리 항목이 혼동을 방지하는 주석을 이미 포함하고 있다. 단, `2-api-convention.md` §3 기본값 표나 `3-error-handling.md` §1 표에 "초대 흐름 한정 lowercase 예외는 `error-codes.md §3` 참조" 식의 역방향 언급이 없어, 코드를 처음 접하는 개발자가 중복처럼 보일 수 있다.
- **제안**: 현재 레지스트리 등재 내용이 이미 충분히 스코프를 제한하고 있어 긴급 조치 불필요. 향후 `2-api-convention.md` §3 기본값 표에 footnote 형태로 "초대 흐름의 historical-artifact `forbidden`/`rate_limited` 는 `error-codes.md §3` 참조" 를 추가하면 탐색성 향상.

---

## 요약

이번 변경(PR-A2a `_resumeCheckpoint` schemaVersion 견고화 + 초대 에러 코드 historical-artifact 등재)의 핵심 영역인 `spec/5-system/` 4개 파일과 `spec/conventions/` 2개 파일 간 내부 일관성은 양호하다. `schemaVersion` 도입으로 추가된 "미래 버전" 트리거 케이스가 `3-error-handling.md` / `6-websocket-protocol.md` / `4-execution-engine.md` / `1-ai-agent.md` / `node-output.md` 5개에 균일하게 반영됐다. 유일한 누락은 인접 채널 spec(`telegram.md` §5.7)에서 `RESUME_INCOMPATIBLE_STATE` 발생 케이스를 prose 로 열거하는 부분으로, "미래 버전" 케이스가 추가되지 않았다 — 직접 모순 수준(작동 불가)이 아닌 서술 누락이다. 초대 에러 코드 historical-artifact 등재는 `error-codes.md §3` 에만 추가됐고 참조 spec(`1-auth.md §1.5.4`)에서도 일관되게 주석 처리됐으며, 표준 코드(`FORBIDDEN`/`RATE_LIMITED`)와의 혼동 방지 주석도 충분하다.

## 위험도

LOW
