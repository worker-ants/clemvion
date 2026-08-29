# 테스트(Testing) 리뷰 결과

## 검토 범위 메모

이번 diff 는 두 부분으로 구성된다:
1. `codebase/frontend/src/lib/docs/__tests__/spec-links.{ts,test.ts}` — 멀티라인 마크다운
   링크 사각지대 수정 + 신규 테스트 9건.
2. `plan/in-progress/harness-review-gate-followups.md`, `review/code/2026/08/29/14_36_39/**` —
   직전 리뷰 라운드(14_36_39)가 잡은 Critical(plan 예시 문구가 자기 자신을 검사하는
   `plan-frontmatter.test.ts` 를 RED 로 만듦)에 대한 RESOLUTION 커밋. `review/code/**` 파일들은
   과거 라운드의 산출물이라 테스트 관점에서 직접 리뷰할 대상이 아니며, 여기서는 그 라운드가
   지적한 문서화 WARNING(#5: `MdLink.line`/`raw` 필드 주석 부재)이 실제로 코드에 반영됐는지만
   교차 확인했다.

## 발견사항

- **[INFO]** `MdLink`/`LinkViolation` 인터페이스 필드 주석 — 직전 라운드(`review/code/2026/08/29/14_36_39/documentation.md` WARNING)가 지적한 계약 미문서화가 이번 커밋에서 이미 해소됨을 실측으로 확인했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:74-76` (현재 파일 직접 `Read` 확인).
  - 상세: `line: number; // 링크가 **시작한** 줄 (멀티라인이면 첫 줄)`, `raw: string; // 멀티라인 링크면 **개행을 포함**한다` 주석이 실제로 붙어 있다. 재지적 불필요.

- **[INFO]** `findBrokenLinks` 외 나머지 두 공개 진입점(`findBrokenSpecLinksInSources`, `findBrokenPlanLinks`)은 멀티라인 픽스처로 통합 검증되지 않았다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — "멀티라인 링크의 깨진 타깃도 잡힌다" 블록(신규, `findBrokenLinks(root)` 만 호출)과 기존 `findBrokenPlanLinks`/`findBrokenSpecLinksInSources` describe 블록(각각 §`findBrokenPlanLinks (living plans)`, §`findBrokenLinksInFiles core`)은 서로 다른 테스트라 교차하지 않는다.
  - 상세: 세 진입점 모두 같은 `findBrokenLinksInFiles` 코어 + 같은 `extractLinks` 를 공유하므로 판별력이 낮다는 RESOLUTION 의 판단(#17 관련)에는 동의한다. 다만 이번 Critical 사고의 실제 발화점이 `findBrokenPlanLinks`(plan 스코프)였다는 점을 감안하면, 그 진입점 하나만이라도 멀티라인 DEAD 픽스처를 태우는 케이스가 있었으면 "이 폴더가 반복해 데인 형태" 서사와 더 정확히 대칭됐을 것이다. 우선순위는 낮다 — 새 결함을 잡을 가능성보다는 문서적 대칭성 문제에 가깝다.
  - 제안: 여유가 되면 `findBrokenPlanLinks (living plans)` describe 블록에 멀티라인 DEAD 링크 한 줄만 추가해 세 진입점 모두를 멀티라인 경로로 지나가게 한다. 조치 안 해도 무방.

- **[INFO]** `buildMaskedDoc`/`lineForOffset` 두 신규 헬퍼가 export 되지 않아 `extractLinks()` 를 통한 간접 테스트만 가능하다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `buildMaskedDoc`(~148행)·`lineForOffset`(~172행) 정의부, `spec-links.test.ts` 전체(직접 import 없음).
  - 상세: 공개 API 만 테스트하는 것은 정상적인 관례이고, WARNING #4 로 지적됐던 "링크가 하나뿐이면 이진 탐색 off-by-one 이 숨는다" 사각지대는 이번 PR 이 "멀티라인 링크 2개(:3·:8)", "단일+멀티 혼재(:3·:5·:8)", "3줄 스팬(:5)" 세 케이스로 이미 정확히 겨냥해 막아 두었다 — 별도 export 없이도 충분히 판별력 있는 테스트다. 향후 마스킹/오프셋 로직이 더 복잡해지면 그때 재검토할 사안이라 지금은 조치 불요.

- **[INFO]** (검증 완료) RESOLUTION.md 의 "unit: frontend 6,213 passed, 신규 9건 포함" 주장을 실측으로 교차 확인했다.
  - `_test_logs/unit-20260829-145321.log:1204` → `Tests  6213 passed | 1 skipped (6214)`. diff 상 신규 `it(...)` 블록을 직접 세어 보면 정확히 9건(멀티라인 describe 8건 + 통합 DEAD describe 1건)으로 일치한다. `grep -ci fail` 로 걸린 203건은 전부 백엔드 Jest 스위트가 의도적으로 시뮬레이션한 실패 로그(`boom`, `SMTP down` 등)이며 실제 테스트 실패가 아님을 확인했다.

## 테스트 설계 품질 (긍정 관찰)

- 9개 신규 케이스가 "링크 텍스트 2줄", "3줄 스팬", "단일+멀티 혼재", "링크 2개 이상"(off-by-one 사각지대 겨냥), "목적지는 줄을 못 넘는다"(역방향), "펜스 사이에 새 링크가 생기면 안 된다"(역방향), "DEAD 통합 경로"까지 — 종전 실측 결함(2026-08-11, `spec/**.md` 6건 + 거버넌스 2건)을 정확히 반증하는 형태로 짜여 있다.
- Mock 사용 없음 — `fs.mkdtempSync`/실제 파일시스템으로 각 describe 마다 격리된 임시 디렉터리를 쓰고 `afterAll` 에서 정리한다. 스캐너가 실제로 파일을 읽는 로직이라 실동작과의 괴리가 없다.
- 테스트 격리: describe 블록마다 고유 prefix(`extract-links-ml-`, `ml-broken-`)의 tmp 디렉터리를 쓰므로 블록 간 의존성 없음.
- 가독성: 모든 `it` 제목이 한국어로 "무엇을·왜" 를 명시하고, 상당수가 "이 테스트가 실패하면 무엇이 무너지는가"를 인라인 주석으로 남겨 의도가 분명하다 (예: "링크가 하나뿐이면 그 탐색이 항상 0번 줄 근처를 맞혀 off-by-one 이 숨는다 — 두 개 이상이어야 관측된다").
- 회귀 테스트: 기존 4개 describe 블록(`findBrokenLinksInFiles core`, `findBrokenPlanLinks`, 사전 필터 3건)은 이번 diff 로 수정되지 않았고, 구현이 "라인 단위 매칭 → 전문 마스킹 매칭"으로 바뀌었어도 공개 함수 시그니처·산출 계약(`fingerprint` 형태)이 그대로라 여전히 유효하다 — 실측 로그로 GREEN 확인됨.

## 요약

멀티라인 링크 사각지대 수정에 대한 테스트는 매우 탄탄하다 — 9개 신규 케이스가 정확히 과거 실측 결함과 그 반대 방향 오류(넓히기 과다) 양쪽을 겨냥하고, off-by-one 사각지대(링크 1개일 때 이진 탐색이 우연히 맞는 문제)까지 별도로 막아 뒀다. Mock 없이 실제 파일시스템 기반 테스트를 쓰고 격리도 안전하다. 직전 라운드가 지적한 인터페이스 문서화 WARNING 은 이번 커밋에서 이미 해소됐음을 직접 확인했다. 남는 항목은 전부 INFO 수준(ANCHOR 경로·다른 두 진입점의 멀티라인 통합 테스트 부재, 헬퍼 비공개로 인한 간접 테스트)이며, 리뷰가 스스로 낮은 판별력을 근거로 우선순위를 낮췄다는 판단에 동의한다. CRITICAL/WARNING 급 테스트 갭 없음.

## 위험도

NONE
