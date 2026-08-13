# 문서화(Documentation) 리뷰 결과

## 검토 방법

이 diff(`origin/main...HEAD`)는 `update-returning-tuple-shape` 결함 수정(핵심 코드 9개
backend 파일)과, 그 작업 과정에서 이미 5차례(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`/
`23_46_00` + consistency 3라운드) 진행된 `/ai-review`·`/consistency-check` 세션 산출물의
누적 커밋이다. 이전 다섯 라운드의 documentation 리뷰(`review/code/2026/08/13/*/documentation.md`)가
이미 CRITICAL 1건·WARNING 다수를 찾아 대부분 조치했으므로, 이번 라운드는 (a) 그 조치들이
실제로 현재 소스에 반영돼 있는지 `Read`/`Grep`으로 직접 재검증하고 (b) 이전 라운드가 못 본
새 항목이 있는지를 확인하는 데 집중했다.

이전 라운드가 지적했던 항목 중 아래는 현재 소스에서 **모두 해소를 직접 확인**했다:
- `execution-engine.service.ts`의 "RETURNING id 이므로 실제 shape 은 행 배열이다" /
  "위 제네릭은 주장이지 검증이 아니다" 두 개의 stale 모순 주석 — 둘 다 제거됨(`grep -n "위 제네릭"` 0건).
- 7~8개 소비 지점의 `.query<{ id: string }[]>` / `Array<{ id: string }>` 제네릭 — 전부
  `: unknown` 애너테이션으로 통일됨(`knowledge-base.service.ts:533`의 embedding 재큐 분기 포함,
  이 지점은 22_45_24/23_07_11 두 라운드에 걸쳐 "조치 완료"로 잘못 선언됐던 곳인데 이번엔 실제로
  고쳐져 있다).
- `update-returning-rows.spec.ts`의 `EXPECTED` 주석("파일, 소비 지점 수, 그중 처리된 수" 3항목
  예고) vs 실제 `Array<[string, number]>` 2-tuple 불일치 — 주석이 "2-tuple 이다"로 정정됨.
- `retry-turn-terminal-guard.md`의 "각주 갱신이 planner 위임 항목에 등재돼 있다"는 단언이
  가리키는 실체 부재 문제 — `update-returning-tuple-shape.md` §후속의 `[planner 위임]` 블록에
  다섯 번째 항목(`node-cancellation.md`)으로 실제 등재됨, 두 문서가 서로 참조 일치.
- `update-returning-tuple-shape.md` 자체의 자기모순(§후속 "frontmatter 는 `none` 을 유지한다"가
  상단 배너의 반박 논리와 공존, "넷이다" vs 실제 다섯 항목) — 둘 다 정정 확인(`grep` 0건, 본문
  "다섯이다"로 일치).

## 발견사항

- **[INFO]** 신규 주석이 존재하지 않는 "①" 표식을 참조한다 — 대응하는 라벨이 파일 어디에도 없음
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:727`
    (`// ① 과 같은 CAS 락 — 튜플이라 거절 분기가 사문화돼 있었다.`, `reEmbedAll` 의 CAS 락 앞)
  - 상세: 이 주석은 "①"이 가리키는 대상(re-extract CAS 락, `:335-344` 부근)을 참조하는데,
    해당 위치를 포함해 파일 전체에 "①"/"②"/"③" 같은 번호 라벨이 실제로 붙은 곳은 없다
    (`grep -n "①\|②\|③"` 결과 이 한 줄만 매치). 즉 "① 과 같은" 이라는 표현이 가리키는
    "①"이 문서 어디에도 정의돼 있지 않은 채 암묵적으로 "이 함수보다 앞서 나온 첫 번째 CAS
    락 블록"을 가리킨다고 추측해야 한다. `git log -p --follow`로 확인한 결과 최초 수정
    커밋(`8332d9a20`)부터 이 형태였고, 이후 5차례의 코드 리뷰 documentation 라운드
    (`20_36_35`~`23_46_00`)에서 한 번도 지적되지 않은 채 지금까지 남아 있다. 기능에는
    영향이 없고, 같은 함수 안에 실측 근거("사문화돼 있었다")가 이미 정확히 서술돼 있어
    독해에 큰 지장은 없지만, 번호 참조 자체는 정의 없는 포워드 레퍼런스라 다음에 두 CAS
    락 사이에 코드가 추가되거나 순서가 바뀌면 더 헷갈릴 수 있다.
  - 제안: "① 과 같은 CAS 락" 을 "re-extract CAS 락과 같은 패턴" 처럼 함수명/역할로 직접
    지칭하도록 바꾼다. 필수 수정은 아님.

- **[INFO]** `assertRowArray` JSDoc 이 자매 헬퍼 `updateReturningRows` 를 여전히 상호 참조하지 않는다 (3라운드 연속 반복 지적, 매번 "선택사항"으로 유예)
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:1-15` (JSDoc 전체)
  - 상세: `updateReturningRows` 쪽 JSDoc(`update-returning-rows.ts:1-35`)은 `assertRowArray`
    를 "자매 헬퍼"로 명시 언급하고 두 헬퍼의 SELECT/UPDATE·DELETE 분담도
    `assert-row-array.spec.ts:76-81` 주석에 기록돼 있지만, 정작 `assertRowArray` 함수
    정의 자체(가장 먼저 읽히는 자리)에는 이 분담이나 `updateReturningRows` 로의 포인터가
    없다 — 단방향 참조. `20_36_35`/`22_45_24`/`23_07_11` 세 라운드가 동일 항목을 INFO 로
    반복 지적했고 그때마다 "필수 아님, 여력이 되면"으로 명시적으로 유예됐다. 이번 최종
    상태에서도 미반영임을 재확인했다 — 새로운 결함은 아니고, 세 번 유예된 결정이 그대로
    유지되고 있다는 사실만 기록한다.
  - 제안: 조치 불요(기존 유예 결정 유지). 다음에 이 파일을 손댈 일이 생기면 JSDoc 끝에
    "UPDATE/DELETE RETURNING 소비는 `updateReturningRows` 를 쓸 것" 한 줄 추가.

- **[정보/확인]** CHANGELOG 미기재는 유실이 아니라 근거와 함께 추적되고 있음(재확인)
  - 위치: `CHANGELOG.md`(리포 루트, 이번 diff 미포함) — `plan/in-progress/update-returning-tuple-shape.md`
    `## 후속` 절 `- [ ] **CHANGELOG Unreleased 항목**` 항목
  - 상세: `CHANGELOG.md` 를 직접 확인한 결과 이번 건 관련 Unreleased 항목은 아직 없지만,
    plan 후속 체크리스트에 "배포 영향 서술과 함께 써야 의미가 있어 릴리스 시점 판단으로
    미뤘다"는 근거와 함께 무엇을 적을지(소셜 로그인 상시 실패·admission cap 미집행·KB
    CAS 락 미작동·재큐 `documentId: undefined`)까지 구체적으로 등재돼 있다. 저장소가 겪어온
    "미룬 항목이 plan 에 안 남아 유실" 패턴과 달리 이번은 제대로 추적되고 있어 문제 없음.
  - 제안: 없음.

- **[정보/확인]** README·API 문서·설정 문서 갱신 대상 없음
  - 상세: 이번 diff 는 신규 API 엔드포인트·DTO·환경변수·설정 옵션을 추가하지 않는 순수
    내부 버그 수정(TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플 shape 오인 정정)이다.
    `user_guide_sync` 리뷰(`review/code/2026/08/13/20_36_35/user_guide_sync.md`)가 매트릭스
    21행 전수 대조로 이미 동일 결론을 내렸고, 이번 최종 diff 에도 컨트롤러·DTO·환경변수·
    `content/docs/` 변경이 없음을 `git diff --stat` 으로 확인했다.

## 요약

이 diff 의 핵심 신규 코드(`update-returning-rows.ts`/`.spec.ts`, 8개 소비 지점 주석)는
문서화 품질이 이 저장소 기준으로도 높다 — 헬퍼 JSDoc 이 실측 DB 프로브 표·실패 모드·기존
3개 관용구와의 관계·"신규 지점은 이 헬퍼를 쓴다"는 지침까지 갖췄고, plan 문서
(`update-returning-tuple-shape.md`)도 Overview/실측/소급 영향/체크리스트/후속/Rationale
구조를 충실히 갖췄다. 5차례의 선행 리뷰 라운드가 찾은 documentation CRITICAL 1건(모순되는
옛 주석)과 WARNING 다수(오도된 타입 애너테이션 7~8곳, EXPECTED 주석 불일치, plan 자기모순
2건, 존재하지 않는 등재 참조)는 이번 최종 상태에서 **전부 실제로 해소돼 있음을 직접
재확인**했다. 이번 라운드에서 새로 남은 것은 기능에 영향 없는 INFO 2건뿐이다 — (1)
`knowledge-base.service.ts:727`의 "① 과 같은 CAS 락" 주석이 파일 어디에도 정의되지 않은
"①" 번호를 참조하는 포워드 레퍼런스(최초 커밋부터 있었고 5라운드 동안 미지적), (2)
`assertRowArray` JSDoc 이 자매 헬퍼를 역참조하지 않는 것(3라운드 연속 "선택사항"으로 유예,
이번에도 미반영이나 새로운 결정은 아님). CHANGELOG 지연·README/API/설정 문서 무갱신은
근거와 함께 정상 추적되고 있어 문제 없다. CRITICAL/WARNING 급 문서화 결함은 없다.

## 위험도

NONE
