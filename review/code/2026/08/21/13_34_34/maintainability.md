# 유지보수성(Maintainability) Review — masked-marker-contract-7d2e14 (13_34_34)

## 검토 범위

이 PR 은 `origin/main` 대비 누적 diff 로, 이번이 5라운드째 리뷰다. 직전 4라운드
(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`)가 찾은 유지보수성 WARNING(감시 목록 자체가
미러·전수처럼 보이지만 아닌 스캔 범위·완료형 서술이 거짓)은 전부 수정 커밋으로 반영돼
있음을 현재 소스(`masked-marker-mirror-guard.ts` 양쪽, `masked-marker-mirror.spec.ts`/
`.test.ts` 양쪽)를 직접 `Read` 로 열어 확인했다. `13_14_29` 라운드가 지적한 섀도잉
(`const sot`)·루프 불변 재계산도 `sotPrefix` 로 개선돼 루프 밖으로 끌어올려져 있다. 이번
라운드는 그 5번째 수정 커밋(`10fcc43e2`, "반증된 절대 서술이 소스에 그대로 남아 있었다")
자체가 새로 만든 흠을 중심으로 전체 diff 를 재검토했다.

## 발견사항

- **[WARNING] 라운드5 가 고친 "절대 서술 → 조건부 서술" 정정이 backend 쪽 test 파일에는
  본문만 고쳐지고, 같은 정정에서 frontend 에 새로 추가된 "행동 규칙" 문단이 backend 에는
  빠졌다 — 이 PR 이 다섯 라운드째 반복 지적해 온 바로 그 비대칭 패턴의 문서판**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:29` (JSDoc 헤더, `describe` 블록 바로 위) — 비교 대상: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:39-47`
  - 상세: 라운드5 커밋(`10fcc43e2`)은 "탐지 로직의 중복은 구멍을 만들지 않는다" 는 절대 서술이 이 PR 자신의 이력에서 두 번 반증됐다며, 그 문장이 있던 **3곳**(`frontend test.ts`·`backend spec.ts`·`backend guard.ts`)을 전부 조건부 표현("한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다")으로 고쳤다 — 이 3곳 교정 자체는 직접 `grep` 으로 확인했고 정확하다. 그런데 같은 커밋에서 `frontend test.ts` 에는 그 위에 "**다만 그 안전은 조건부다** … 로직 결함은 두 사본에 동시에 존재하므로 중복이 막아주지 않는다 … **규칙**: 판정 분기를 새로 넣거나 고칠 때는 양쪽에 대칭 캐너리를 함께 넣는다" 라는 문단을 새로 추가했는데, `backend spec.ts` 에는 이 문단이 없다(`grep -n "대칭\|캐너리를 함께" masked-marker-mirror.spec.ts` 로 확인 — 매치 없음). `backend guard.ts` 는 이전 라운드(`12_50_37`)부터 이미 이 규칙을 파일 헤더에 갖고 있어(다른 문구지만 같은 내용) 문제가 없지만, **backend spec.ts 만 이 행동 규칙이 빠진 채로 남았다.** 즉 "판정 분기를 고칠 때 양쪽에 대칭 캐너리를 넣으라" 는, 정확히 이 PR 이 라운드3·4에서 겪은 실패를 막기 위한 경고문이 backend 쪽 테스트 파일 독자에게는 안 보인다 — 향후 backend spec.ts 를 단독으로 편집하는 사람이 frontend 쌍둥이를 잊을 위험을 이 문서 자신이 줄여주지 못한다는 점에서, 이 PR 의 핵심 메타 교훈과 정면으로 부딪히는 형태의 잔여 비대칭이다. 기능적 영향은 없다(테스트 동작·가드 로직은 무관).
  - 제안: `backend/.../masked-marker-mirror.spec.ts:30` 뒤에 frontend 와 동일한 취지의 문단(`> **다만 그 안전은 조건부다** … **규칙**: 판정 분기를 새로 넣거나 고칠 때는 양쪽에 대칭 캐너리를 함께 넣는다`)을 추가해 두 test 파일의 헤더 정보량을 맞춘다.

- **[INFO]** 위 문단을 고치는 과정에서 생긴 비정상적으로 긴 한 줄(파일 내 최장 라인의 약 1.3배)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:29`
  - 상세: 이 파일의 JSDoc 은 대체로 90바이트 내외에서 줄바꿈되는데, 29번째 줄만 168바이트로 다음으로 긴 줄(129바이트)보다 눈에 띄게 길다. `"값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다**:"` 문구를 이어붙이면서 줄바꿈을 하지 않은 것으로 보인다. 가독성에 미미한 영향만 있다.
  - 제안: frontend `masked-marker-mirror.test.ts:39-40` 처럼 문장 중간에서 줄바꿈해 다른 줄과 폭을 맞춘다. 위 WARNING 을 고치는 김에 함께 정리하면 비용이 없다.

## 요약

이 PR 은 5라운드에 걸쳐 유지보수성 관점의 실질 결함(가드 배치가 만든 경로 게이팅 사각지대·감시 목록 자체가 미러·스캔 범위가 전수처럼 보이지만 아님·완료형 서술이 거짓)을 전부 해소했고, 매 라운드의 근거를 소스 인접 주석에 남기는 규율을 지켜 왔다. 이번 라운드에서 새로 검토한 5번째 수정 커밋은 그 자체로 "반증된 절대 서술이 소스에 남아 있었다" 는 문서 정확성 문제를 고치려던 것인데, 그 수정 과정에서 frontend 쌍둥이 파일에만 새 "대칭 캐너리 규칙" 문단을 추가하고 backend 쌍둥이(`masked-marker-mirror.spec.ts`)에는 넣지 않아 두 파일의 문서 정보량이 다시 어긋났다 — 코드 동작에는 영향이 없지만, 이 PR 이 반복해서 겪고 스스로 경계해 온 "한쪽만 고쳐진 채 완료형 서술이 남는" 패턴이 문서 레벨에서 재현된 것이라 WARNING 으로 남긴다. 그 외 핵심 로직(`findRedeclaredSymbols`/`findMirrorRedeclarations`/`resolveScanDirs`)은 함수가 짧고 책임이 하나씩이며 중첩도 얕고(최대 for-for-if 3단), `@workflow/masked-markers` 패키지 추출·재export 전략·CI 배선 8곳 모두 기존 컨벤션(`@workflow/ai-end-reason` 등)과 일관되다. 이전 라운드가 이미 "조치 불요"로 판정한 항목(`prepare` 스크립트 9번째 사본, `SOT_DIR` 자기 제외 분기, 탐지 로직 자체의 backend/frontend 중복)은 근거가 여전히 유효해 재론하지 않았다.

## 위험도
LOW
