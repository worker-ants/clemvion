# 유저 가이드 동반 갱신(User Guide Sync) 검토 — `eia-error-code-unify` (재판정, `17_32_01`)

## 방법론

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SSOT 로 Read, `PROJECT.md` §변경 유형 → 갱신
위치 매핑(127~197행) 을 보조로 Read. 변경 파일 35건(코드 4 · docs mdx 2 · plan 2 · review 산출물
21 · consistency 산출물 8(중 review 21 은 하위 세분) · spec 6) 을 각 매트릭스 행에 매칭.

이번 라운드는 이전 라운드(`17_06_14`, 같은 reviewer 가 이미 NONE 판정 + `review/code/.../17_06_14/user_guide_sync.md` 로 커밋됨)에서 **커버된 핵심 diff(controller.ts swagger + triggers.mdx/.en.mdx)에 새 변경이 없고**, 그 이후 추가된 파일은 (1) `CHANGELOG.md` 신설 절, (2) 테스트 단언 보강(`executions-rerun.service.spec.ts`), (3) 코드 주석 추가(`executions.service.ts`), (4) plan 트래커 체크박스 갱신, (5) 이전 리뷰/consistency 라운드의 산출물 커밋이다. 이 5종 모두 매트릭스 어느 trigger 도 새로 발생시키지 않는다 — 직접 재검증으로 확인했다(아래).

## 매트릭스 매칭

| trigger (id) | 매칭 여부 | 근거 |
|---|---|---|
| `backend-api-change` | **매칭** (선행 커밋에서 이미 완결) | `executions.controller.ts:274` swagger jsdoc 변경 |
| `new-node` / `node-schema-change` | 불일치 | `codebase/backend/src/nodes/**` 미변경 |
| `new-error-code` (glob `error-codes.ts`) | 불일치 | 해당 파일 미변경. `INVALID_TRIGGER_PARAMETERS`/`INVALID_INPUT` 은 `ErrorCode` enum 밖의 HTTP 봉투 최상위 코드 |
| `new-warning-code` | 불일치 | warningRules 미변경 |
| `new-ui-string` (glob `*.tsx`) | 불일치 | `.tsx` 변경 없음(이번 diff 세트) |
| `new-userguide-section-dir` | 불일치 | 신규 섹션 디렉토리 없음 |
| `spec-major-change` | 매칭(참고, 스코프 밖) | spec 6파일 — 별도 5-agent consistency-check(`16_34_50`, BLOCK:NO) 커버, 본 리뷰어 스코프(docs mdx/i18n dict/backend-labels) 밖 |
| 그 외(auth/expression/run-debug/integration 등) | 불일치 | 해당 경로 미변경 |

## 직접 재검증 (이번 라운드에서 재확인, 현재 파일 상태 기준)

```
grep -n "INVALID_INPUT|INVALID_TRIGGER_PARAMETERS" codebase/frontend/src/lib/i18n/backend-labels.ts
→ 0건 (exit=1)

grep -n "INVALID_INPUT|INVALID_TRIGGER_PARAMETERS" \
  codebase/frontend/src/content/docs/02-nodes/triggers.mdx \
  codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx
→ triggers.mdx:33  "...실행이 `INVALID_TRIGGER_PARAMETERS`로 실패해요."
→ triggers.en.mdx:22 "...fails the run with `INVALID_TRIGGER_PARAMETERS`."
  (KO/EN parity 확인 — 한쪽만 갱신된 CRITICAL 케이스 아님)

grep -rl "INVALID_INPUT" codebase/frontend/src codebase/channel-web-chat/src
→ 0건 (exit=1) — 잔존 구 코드 참조 없음

rerun-modal.tsx ERROR_CODE_TO_KEY 테이블 (line 91-102)
→ RERUN_PERMISSION_DENIED / RERUN_CHAIN_DEPTH_EXCEEDED / RERUN_WORKFLOW_DELETED /
  RERUN_DRY_RUN_NOT_APPLICABLE 4종만 매핑. INVALID_INPUT·INVALID_TRIGGER_PARAMETERS 는
  리네임 전후 동일하게 generic fallback("history.rerun.genericError") 으로 떨어짐
  → 매핑 테이블 동작 불변, dict 갱신 대상 아님
```

## 누락 검출 결과

`backend-api-change` 의 두 target 모두 같은 변경 set 안에서 충족 확인:
- **(a) swagger jsdoc** — `executions.controller.ts:274` `INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE` → `INVALID_TRIGGER_PARAMETERS / RERUN_DRY_RUN_NOT_APPLICABLE`.
- **(b) user-guide 페이지** — `triggers.mdx:33`(KO) + `triggers.en.mdx:22`(EN) FieldTable `required` 행 description 이 양쪽 동시 갱신.

`INVALID_TRIGGER_PARAMETERS`/`INVALID_INPUT` 은 `ErrorCode` enum(row `new-error-code`)도
`warningRules`(row `new-warning-code`)도 아닌 HTTP 봉투 최상위 코드라 `backend-labels.ts` 의
`WARNING_KO`/`ERROR_KO` 매핑 대상이 애초에 아니다 — grep 으로 재확인, 0건.

이번 라운드에서 새로 추가된 파일(`CHANGELOG.md` 절, 테스트 단언, 코드 주석, plan 체크박스)은
사용자 가시 UI 문자열·노드 스키마·통합·섹션 디렉토리·인증 흐름·표현식 언어·실행/디버깅 흐름 중
어느 것도 건드리지 않아 새 trigger 를 발생시키지 않는다.

## 요약

매트릭스 21행 중 매칭된 것은 `backend-api-change`(swagger+user-guide 동반 갱신, 선행 커밋에서 완결
확인) 1건과 참고용 `spec-major-change`(별도 consistency-checker 커버, 본 스코프 밖) 1건이다. 이번
재판정 라운드에서 grep 으로 직접 재검증한 결과 — backend-labels.ts 매핑 대상 아님(0건 확인),
triggers.mdx/.en.mdx KO/EN parity 유지, 프런트/위젯 소스에 구 코드(`INVALID_INPUT`) 잔존 0건,
rerun-modal.tsx 매핑 테이블 동작 불변 — 누락된 동반 갱신은 없다. 새로 추가된 파일(CHANGELOG,
테스트, 주석, plan)도 신규 trigger 를 발생시키지 않는다.

## 위험도

NONE
