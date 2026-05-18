# RESOLUTION — node-config-required-defaults sweep

본 RESOLUTION 은 `SUMMARY.md` 의 발견사항들을 분류·처리한 결과를 기록.

## 처리 요약

| 분류 | 처리 | 사유 |
|---|---|---|
| Critical | 0건 | — |
| WARNING | 5건 → 즉시 fix 2, 합의 필요 2, false alarm 1 | 아래 항목별 상세 |
| INFO | 15건 → 후속 항목으로 트래킹 | 아래 항목별 상세 |

## WARNING 처리

### W-1 — `loop.count` dead warningRule + ui.required 의미 충돌 → **합의 필요 (후속)**

`count.default('1')` 이라 `!count` warningRule 이 발화 안 되는 dead rule 상태. `ui.required: true` 와도 의미 충돌.

**자동 처리 중단 사유** — SKILL.md §8 안전 가드 "팀이 결정해야 하는 항목" 에 해당. `default('1')` 을 `default('')` 로 바꾸면 신규 노드 생성 시 사용자 경험이 바뀌고, 기존 workflow 마이그레이션 영향을 사용자 확인 없이 결정할 수 없음.

**조치**: 별도 follow-up 으로 분리. `plan/in-progress/node-config-required-defaults-sweep.md` 의 "후속 follow-up" 섹션에 추가.

### W-2 — `send-email.to` zod ↔ validator 비대칭 → **합의 필요 (후속)**

zod `to: z.array(z.string()).default([])` 와 `validateSendEmailConfig` (문자열도 허용) 가 어긋남. 단일 문자열 형태로 저장된 기존 데이터의 zod 파싱 영향.

**자동 처리 중단 사유** — Breaking change 여부 (기존 저장된 `to` 가 string 인 workflow 가 있는지 DB 확인 필요) 가 사용자 결정 사항.

**조치**: 별도 follow-up. plan 후속 섹션에 추가.

### W-3 — `switch.switchValue` hidden + requiredWhen 충돌 → **false alarm**

`requiredWhen: { notEquals: 'expression' }` 이 hidden 필드에도 적용되어 asterisk 누출 우려.

**검증 결과**: `schema-form.tsx:153-154`

```tsx
if (ui?.hidden) return null;
if (!isFieldVisible(ui, value)) return null;
```

— hidden / visibleWhen=false 인 필드는 렌더링 자체를 안 함. `isFieldRequired` 호출은 그 뒤(L157)에 있어 asterisk 가 보일 수 없다. **충돌 발생 불가**.

또한 `visibility.ts:5-11` 의 `matches` 함수가 `equals` / `notEquals` / `oneOf` 모두 처리하므로 `notEquals` 키도 기존 지원 범위 안. INFO 3 도 동시 해소.

**조치**: 코드 변경 불필요.

### W-4 — Logic 카테고리 warningRules 회귀 테스트 부재 → **false alarm (실측 결과 모두 존재)**

reviewer 가 "확인 불가" 라고 표현했으나 실측:

| 노드 | warningRules 관련 assertion 카운트 |
|---|---|
| foreach | 6 |
| map | 6 |
| split | 6 |
| loop | 11 |
| switch | 18 |

모두 fired/not-fired 케이스를 가지고 있음. **테스트 부재 사실 아님**.

**조치**: 코드 변경 불필요.

### W-5 — `send-email.schema.spec.ts` it.each 콜백 destructuring 누락 → **즉시 fix 완료**

콜백이 `(key) => ...` 였는데, 두 번째 인자(`ruleId`)를 받지 않아 테스트 이름에만 서술되고 실제 검증되지 않던 부분.

**commit**: `3bfe3472 test(send-email): ui.required ↔ warningRule id 연결을 실제 검증`

콜백을 `(key, ruleId)` 로 확장하고 `sendEmailNodeMetadata.warningRules.some(r => r.id === ruleId)` 추가 검증 — 두 source 가 명시적으로 묶이도록 강제.

## INFO 처리

| # | 항목 | 처리 |
|---|---|---|
| 1 | `send-email` `disableFileAccess: true` 핸들러 확인 | 본 PR 범위 밖 (기존 코드). 별도 보안 리뷰 권장 |
| 2 | `isRecipientsLike` RFC 5321 형식 검증 부재 | 본 PR 범위 밖 (기존 로직) |
| 3 | `requiredWhen.notEquals` frontend 지원 확인 | W-3 검증에서 해소 — `visibility.ts:matches` 가 `notEquals` 처리 |
| 4 | `loop.breakCondition` 임의 표현식 허용 | 본 PR 범위 밖 (기존 로직). 표현식 엔진 샌드박싱 별도 리뷰 |
| 5 | `VALID_OPERATIONS` / `VALID_OPS` 중복 선언 | 본 PR 범위 밖 (기존 로직 리팩토링). 후속 follow-up |
| 6 | 테스트 패턴(인라인 vs 공유 헬퍼) 혼재 | 후속 follow-up — 공유 헬퍼 추출은 다른 PR 에서 |
| 7 | `uiMeta` 시그니처 `ZodObject` 좁음 | 후속 follow-up |
| 8 | 주석 상세도 파일별 차이 | 후속 follow-up — 통일 가이드 별도 정리 |
| 9 | `uiMeta` 함수 독스트링 부재 | 영향 미미, 후속 |
| 10 | `send-email subject/body` `.default('')` + `ui.required` 조합 주석 부재 | 후속 |
| 11 | `form.fields.ui.required` vs `formFieldSchema.required` 동명 혼동 | 후속 |
| 12 | `requiredWhen.notEquals` plan 문서 명시 | W-3 검증에서 해소 — 기존 키 |
| 13 | `presentation-button-render-investigation.md` 분리 | 의도된 구성 — frontmatter `worktree` 가 본 sweep 과 같지만, 본 sweep PR 안에서 함께 트래킹 의도 (별 fix PR 분리는 root cause 확정 후) |
| 14 | `http-request.schema.spec.ts` describe 블록 위치 | 가독성 미세 이슈, 후속 |
| 15 | `logic-ui-required.spec.ts` 파일 목적 주석 부재 | 후속 |

## 후속 follow-up (별 plan/PR 로 분리)

위 W-1, W-2, INFO-5/6/7/8/10/11/14/15 항목은 본 sweep PR 의 의도 (ui.required 메타 보강) 와 직접 관계가 없거나 팀 합의가 필요한 별 작업이므로, 본 PR 머지 후 별 plan 으로 분리.

해당 후속 항목들은 `plan/in-progress/node-config-required-defaults-sweep.md` 의 후속 follow-up 섹션에 별도 기록.

## TEST 결과

- backend unit: 3952건 (이전 turn) — 본 fix commit 후 send-email 33건 재실행 ALL PASS.
- backend e2e (`make e2e-test`): 16 suites / 93 tests ALL PASS — fix commit 후 재실행.
- backend lint: clean.

## 결론

- Critical 발견 0건 → BLOCK 없음.
- WARNING 5건 중 1건 즉시 fix (W-5) 완료, 2건 합의 필요로 follow-up 이관 (W-1, W-2), 2건 false alarm (W-3, W-4).
- INFO 15건은 본 sweep 의도와 무관하거나 미세 사항 — 모두 후속으로 트래킹.

본 PR 머지 가능 상태.
