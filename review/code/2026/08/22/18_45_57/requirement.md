# 요구사항(Requirement) 리뷰 — egress-masking-convention

## 검토 범위 및 방법

이번 변경은 코드가 아니라 **spec/plan 문서 신설·갱신**이다 (`git diff --stat origin/main...HEAD`, 24 files):
- `plan/in-progress/spec-draft-egress-masking-convention.md` (신설, planner draft)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 항목 `[ ]` → `[x]` + W4 상호 참조)
- `review/consistency/2026/08/22/{18_14_17,18_14_45,18_27_11}/**` (consistency-check 2라운드 산출물)
- **`spec/conventions/egress-masking.md` (신설, 107줄)** — 이 변경의 실질 산출물
- `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` · `spec/conventions/node-output.md` (인입 포인터 3곳 추가)

프롬프트에 담긴 `plan/**` diff 는 draft 초안(1라운드, `18_14_45` BLOCK:YES 시점)이라 최종 커밋(`a331d9abe`)과 다르다. 따라서 `git show a331d9abe`로 최종 상태를 직접 열어 코드(`masked-markers/src/index.ts`, `sanitize-error-message.ts`, `websocket.service.ts`, `strip-external-only-fields.ts`, `reject-masked-resubmission.ts`, `frontend/.../masked-markers.ts`)와 줄 단위로 대조했고, 3개 가드 테스트(`spec-code-paths.test.ts`, `spec-frontmatter.test.ts`, `spec-links.test.ts`, `plan-frontmatter.test.ts`)를 직접 실행해 통과를 확인했다(1120 tests passed).

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-egress-masking-convention.md`의 체크리스트 마지막 항목 `- [ ] /ai-review`가 미체크 상태
  - 위치: `plan/in-progress/spec-draft-egress-masking-convention.md:166`
  - 상세: 본 리뷰(`/ai-review`)가 실행되는 시점 자체를 가리키는 항목이라 미체크가 정상이다. 기능적 결손이 아니다.
  - 제안: 리뷰 완료 후 developer/planner가 체크 처리.

- **[INFO]** consistency-check 1라운드(`18_14_45`)가 낸 CRITICAL(좌표계 표 "값" 열 `= 1` 오독 표기)은 프롬프트에 담긴 draft 스냅샷에는 남아 있으나, 최종 커밋된 `spec/conventions/egress-masking.md`에서는 전부 리터럴 숫자(`**10**`)로 정정됐다(실측: `spec/conventions/egress-masking.md:44-47`). 2라운드(`18_27_11`)가 이를 확인하고 BLOCK:NO로 종결했다.
  - 위치: `spec/conventions/egress-masking.md:44-47`
  - 상세: `plan/**` 문서에 남은 1라운드 draft 텍스트는 review 대상 diff에 그대로 포함돼 있어 시점 혼동 소지가 있으나, 이는 in-progress plan 문서가 작업 이력을 보존하는 정상적인 형태(1라운드 발견 → 처분 로그)이지 미해결 결함이 아니다.

## Spec fidelity 상세 대조 (item 9)

좌표계 표(`spec/conventions/egress-masking.md` §1, 5행)를 실제 소스와 줄 단위로 대조한 결과 전부 일치한다:

| 표 행 | spec 서술 | 코드 실측 | 일치 |
|---|---|---|---|
| 1 `MAX_MASK_DEPTH` | 값 10 | `codebase/packages/masked-markers/src/index.ts` `export const MAX_MASK_DEPTH = 10;` | 일치 |
| 2 `MAX_REDACT_DEPTH`, `depth >= N` → `VALUE_MASK_MARKER`, 소비처 `deepRedactSecrets`·`hasMaskedLeaf` | `sanitize-error-message.ts`: `export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;` / `deepRedactCore`: `if (depth >= MAX_REDACT_DEPTH) return VALUE_MASK_MARKER;` / `reject-masked-resubmission.ts`: `if (depth >= MAX_REDACT_DEPTH) return false;` (`hasMaskedLeaf`) | 일치 |
| 3 프런트 `MAX_MASK_DEPTH`, 값검사 먼저 → `depth >= N`, 소비처 `hasMaskedMarkerLeaf` | `frontend/.../masked-markers.ts` `scanForMarker`: `if (isMaskedMarker(value)) return true; if (depth >= MAX_MASK_DEPTH) return false;` | 일치 |
| 4 `MAX_SANITIZE_DEPTH`, `depth > N` → `DEPTH_MASK_MARKER`, 소비처 `sanitizePayloadForWs` | `websocket.service.ts:80` `export const MAX_SANITIZE_DEPTH = 10;` / `:119` `if (depth > MAX_SANITIZE_DEPTH) return DEPTH_MASK_MARKER;` | 일치 |
| 5 `stripExternalOnlyFields(_, maxDepth)`, `depth > maxDepth` → 보존, 호출부 2곳 | `strip-external-only-fields.ts` `stripDeep`: `if (depth > maxDepth) return value;` / `websocket.service.ts:422-424` `toFanoutEnvelope`가 `MAX_SANITIZE_DEPTH`를 전달 | 일치 |

"마스킹은 한 번" 순서 계약(§2)도 실측과 일치 — `toFanoutEnvelope`(`websocket.service.ts:418`)가 `maskWireEnvelope`(§271/345, 선행 호출) → `stripExternalOnlyFields`(§422) → `attachRoutingContext`(§426) 순으로 호출하며 그 뒤 재마스킹 호출이 없음을 확인했다.

인입 포인터 3곳(EIA §R17, WS §4.1, node-output.md) 모두 실제로 추가됐고(`git show a331d9abe`), 각 spec 문서 문맥에 자연스럽게 삽입돼 기존 서술과 충돌하지 않는다. `1-data-model.md §2.17.2`(AuthConfig 필드 마스킹)와의 "비대상" 콜아웃도 `secret-store.md`의 동형 선례와 대조해 실재를 확인했다(`secret-store.md:40`).

**consistency-check 라운드 간 수렴 검증**: `18_14_45`가 지적한 1건 CRITICAL(값 오독)과 5건 WARNING 중 3건(WS 인입 포인터 누락·`code:` frontmatter 세부 미확정·`hasMaskedLeaf` 표 누락)이 최종본에 전부 반영됐고, `18_27_11` 라운드가 새로 낸 3건 WARNING(exhaustive-consumer `code:` 목록·순서 계약 범위 caveat·W4 상호 참조)도 최종본 §2·§3과 frontmatter `code:` 6파일 목록에서 전부 반영을 확인했다(`code:`에 `reject-masked-resubmission.ts`·`frontend/.../masked-markers.ts` 추가, §2 caveat 문단, §3 stale 트리거 문단, 트래커 쪽 상호 참조 `spec-sync-external-interaction-api-gaps.md:327-329`).

교차 인용된 미체크 항목(`ws-event-types-extract.md:347`의 `TerminalErrorPayload` 전수확인, `spec-sync-external-interaction-api-gaps.md:321`의 W4)도 grep으로 실재를 확인했다 — 지어낸 참조가 아니다.

가드 테스트 3종(`spec-code-paths.test.ts`, `spec-frontmatter.test.ts`, `spec-links.test.ts`, `plan-frontmatter.test.ts`)을 직접 실행해 전부 통과함을 확인했다(1120 tests).

## 요약

이번 변경은 "egress 마스킹 좌표계"라는 파일을 가로지르는 cross-file 불변식(세 깊이 상한·경계 연산자·마커 대응)을 정식 `spec/conventions/egress-masking.md`로 승격하는 순수 문서화 작업이다. TODO/FIXME/HACK 류의 미완성 표식은 없고, 유일한 미체크 항목(`/ai-review`)은 본 리뷰 자체를 가리키므로 결손이 아니다. 좌표계 표의 값·비교 연산자·마커·소비처 심볼을 실제 6개 소스 파일과 줄 단위로 대조한 결과 전부 정확히 일치했고, consistency-check 2라운드(1라운드 CRITICAL 1건 포함)가 낸 지적 사항이 최종 커밋에 남김없이 반영된 것을 diff·grep으로 직접 확인했다. spec-impl-evidence 가드(spec-code-paths·spec-frontmatter·spec-links·plan-frontmatter)도 실행해 통과를 확인했다. 문서가 스스로 명시한 "심볼 기준 인용·마커 리터럴 0회·SoT 미소유 대상 명시" 원칙도 실측대로 지켜지고 있다. CRITICAL/WARNING 없음.

## 위험도

NONE
