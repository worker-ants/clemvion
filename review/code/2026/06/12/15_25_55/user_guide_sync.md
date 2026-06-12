# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [INFO] WORKSPACE_ID_REQUIRED — ERROR_KO 매핑 부재 (pre-existing gap)
- **변경 파일:** `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts`
- **매트릭스 항목:** `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- **누락된 동반 갱신:** `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 항목
- **상세:**
  - 이 PR 이전에도 `WORKSPACE_ID_REQUIRED` 는 `ERROR_KO` 에 없었다. `workspace.decorator.ts` 는 오래전부터 이 코드를 발행해 왔으며, `chat-channel.controller.ts` 만 자체 `WORKSPACE_REQUIRED` (401) 를 쓰던 outlier 였다.
  - 이번 PR 로 chat-channel rotate-bot-token 엔드포인트가 공용 데코레이터로 통일되면서, 해당 엔드포인트 사용자가 처음으로 `WORKSPACE_ID_REQUIRED` 코드를 받게 된다 (기존 `WORKSPACE_REQUIRED` 대신). `ERROR_KO` 매핑이 없으므로 영문 코드 그대로 UI 에 노출된다.
  - 단, 이 gap 은 데코레이터 도입 시점부터 존재했던 **선재 drift** 이며, 본 PR 이 신규 생성한 것은 아니다. docs (triggers.mdx / triggers.en.mdx 양쪽) 에도 "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" 라고 명시되어 있어 인지된 상태다.
  - `new-error-code` 매트릭스 행의 가이드에 따르면 "errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)" 를 권장한다. 이 PR 은 추가가 아닌 통일(rename)이므로 엄격히 해당하지 않지만, 사용자 노출 코드가 바뀐다는 점에서 후속 plan 검토를 권장한다.
- **제안:** 후속 plan 에서 `ERROR_KO["WORKSPACE_ID_REQUIRED"] = "요청에 워크스페이스 ID 가 없어요."` 추가 검토. 이번 PR 범위 밖의 pre-existing gap 이므로 block 사유는 아님.

---

## 동반 갱신 충족 확인 (매칭된 항목)

| 매트릭스 행 | trigger 매칭 | 동반 갱신 필요 | 상태 |
|---|---|---|---|
| `backend-api-change` (semantic: `*.controller.ts` 변경) | `chat-channel.controller.ts` | swagger jsdoc + 관련 user-guide 페이지 | `@ApiOperation` 유지, docs MDX 양쪽(ko+en) 갱신 완료 |
| `node-schema-change` / `new-node` | 미매칭 (nodes 디렉터리 무변경) | — | 해당 없음 |
| `new-ui-string` | 미매칭 (TSX 신규 한국어 리터럴 없음) | — | 해당 없음 |
| `auth-session-flow-change` | 미매칭 (변경 위치 `common/decorators`, `auth/**` 아님) | — | 해당 없음 |
| `new-error-code` | 준매칭 (코드 통일, 신규 enum 추가 아님) | ERROR_KO 매핑 | pre-existing gap — INFO |

**docs MDX i18n parity:**
- `triggers.mdx` (Korean): `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 갱신 완료
- `triggers.en.mdx` (English): 동일 갱신 완료
- 양쪽 로케일 동기 — parity 유지됨 (CRITICAL 없음)

## 요약

매트릭스 전체 17행 기준, 변경 파일이 trigger 에 매칭되는 행은 `backend-api-change` (controller 변경) 1건이며, user-guide docs MDX 갱신(ko+en 양쪽)이 동반되어 충족되었다. `new-error-code` 행에 준매칭되는 `WORKSPACE_ID_REQUIRED` 의 `ERROR_KO` 미등록은 선재 drift(이번 PR 이전부터 존재)로, 이번 PR 이 신규 생성한 누락이 아니다. docs 의 자체 고지("일부 코드는 영문 그대로 노출") 로 인지된 상태이나, 사용자 노출 코드가 사실상 바뀌는 시점이므로 후속 plan 에서 ERROR_KO 등록 검토를 권장한다. 매칭 trigger 1건 / 누락 0건(INFO 1건: pre-existing gap).

## 위험도
LOW
