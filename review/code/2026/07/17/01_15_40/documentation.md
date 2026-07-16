### 발견사항

- **[INFO]** `spec/0-overview.md` §6.1 "485 endpoint"/"161 REST operation" 병기에 날짜·SoT 주석 누락 (동일 패턴이 다른 3곳엔 반영됨)
  - 위치: `spec/0-overview.md` §6.1 "구현 완료" 표, Cafe24/MakeShop 행 (`| **Cafe24 통합** | ... **485 endpoint** ... |`, `| **MakeShop 통합** | ... 161 REST operation ... |`)
  - 상세: 실측 대조 결과, 같은 수치(485/161)를 다루는 다른 3개 위치 — `spec/4-nodes/4-integration/4-cafe24.md`("485 endpoint... 2026-07-17 실측"), `spec/4-nodes/3-ai/1-ai-agent.md` §4.2("Cafe24 485 operation ... 2026-07-17 실측"), `spec/5-system/11-mcp-client.md` §5.8("Cafe24 Admin API 485 operation ... 2026-07-17 실측"), `spec/4-nodes/3-ai/0-common.md`(필드표, "485, 2026-07-17 실측") — 는 모두 날짜·SoT 링크를 동반하는데, `0-overview.md` 표 행만 리터럴 숫자를 무각주로 병기한다. 이는 이번 수정 사이클 자체가 고치려던 "출처 없는 수치 화석"(구 `~180`) 패턴이 새 위치에 다시 씨앗을 남기는 형태다 — 카탈로그가 향후 갱신되면 이 표 행만 무신호로 갱신 누락될 위험. 직전 consistency-check(`review/consistency/2026/07/17/00_35_59/SUMMARY.md` WARNING #6)가 D2~D4 전체에 이 보강을 권고했고 D2(`1-ai-agent.md`)·D3(`11-mcp-client.md`)는 최종 커밋 diff 에 반영됐으나, D4(`0-overview.md`)는 실제 diff 확인 결과 여전히 미반영 상태.
  - 제안: `485 endpoint`/`161 REST operation` 뒤에 각각 `([Cafe24 노드](./4-nodes/4-integration/4-cafe24.md)/[MakeShop 노드](./4-nodes/4-integration/5-makeshop.md) 실측 기준)` 정도의 짧은 SoT 링크만 추가해 4곳의 표기를 정합화. 필수는 아니나 저비용.

- **[INFO]** `spec/conventions/spec-impl-evidence.md` §Rationale 에 신규 정정 서술 대응 R-11 부재
  - 위치: `spec/conventions/spec-impl-evidence.md` §4 가드 표, `spec-link-integrity.test.ts` 행의 신규 인라인 각주("2026-07-16 정정 — 종전 '...' 서술은 구현과 반대였다")
  - 상세: 이 문서는 §Rationale 에 `R-1`~`R-10` 형태로 표-서술의 근거를 정식화하는 자체 관례를 갖고 있다(직접 확인: `R-1`부터 `R-10`까지 순번 존재, `R-11` 없음). 이번 diff 가 추가한 가드 동작 정정은 표 셀 안의 긴 인라인 각주로만 존재하고 대응 `## Rationale` 항목이 없다. `review/consistency/2026/07/17/00_17_40/rationale_continuity.md` 가 이미 동일 사항을 INFO(비필수)로 지적했고 현재도 미반영 상태(코드 재확인 완료).
  - 제안: 필수 아님. 후속 정리 시 `R-11`로 "spec→plan 링크는 `spec-link-integrity` 담당, plan 문서 내부 링크는 `plan-coherence-checker` 담당"이라는 책임 경계를 명문화하면 문서 자신의 관례와 완전히 정합.

- **[INFO]** (확인, 비발견) `spec/2-navigation/4-integration.md` 신규 Rationale("cafe24-token-refresh worker 에러 격리 정책")이 인용하는 코드·테스트 사실 전부 실측 일치
  - 위치: `spec/2-navigation/4-integration.md` §10.5 본문 + 신규 `## Rationale` 절, `cafe24-token-refresh.processor.ts`/`.spec.ts` 인용
  - 상세: `attempts: 1`, `TEST-C2`(re-throw 단언), 삭제된 통합에 대한 "silent no-op" 처리를 코드에서 직접 grep 대조했다 — 모두 spec 서술과 정확히 일치(`cafe24-token-refresh.processor.ts:50` 주석이 spec 문구와 거의 동일한 표현 사용). 우수 사례로 기록.
  - 제안: 조치 불요.

- **[INFO]** 같은 파일(`cafe24-token-refresh.processor.ts`/`.spec.ts`)이 `spec/2-navigation/4-integration.md` frontmatter `code:` 글로브 밖
  - 위치: `spec/2-navigation/4-integration.md` frontmatter `code:` (`codebase/backend/src/modules/integrations/**` 만 등재) vs 실제 인용 파일 경로 `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts`
  - 상세: pre-existing gap이며 `spec-code-paths.test.ts` 가드는 ≥1 매치만 요구해 build 비차단 — `review/consistency/2026/07/17/00_55_57/SUMMARY.md` INFO #2 가 이미 동일 지적을 "조치 불요"로 처분. 다만 이번 diff 가 해당 파일을 이름까지 명시해 근거로 삼는 비중이 커진 만큼, 추적성 강화 차원에서 `code:` 에 명시 추가를 고려할 수 있음(선택).
  - 제안: 조치 불요(선택적 강화).

- **[INFO]** (검증 결과, 비발견) 앞선 3라운드 consistency-check WARNING 대부분이 최종 diff 에서 해소됨을 재확인
  - 상세: `grep -rn "~180" spec/` 결과 잔존 인스턴스 없음(과거 화석을 인용부호로 언급하는 역사 서술 1곳 제외) — `2-navigation/4-integration.md:1110`·`3-ai/0-common.md:63` 모두 485 로 정정됨. `plan/in-progress/node-output-redesign/merge.md`의 "P1 → P2" stale 서술도 "P1 → P3(ADR R-wontdo-async-fanin)"으로 갱신 확인. `R-adr-async-fanin`은 `R-wontdo-async-fanin`으로 개명돼 기존 taxonomy 에 합류. ADR 잔여 UX 결정도 동일 plan 파일에 `(product-decision)` 체크박스로 승계됨. 문서화 완결도가 높다는 근거로 기록.

### 요약

이번 변경분은 대부분 spec 문서(markdown)와 이미 생성된 consistency-check 산출물(`review/consistency/**`)로 구성되며, 실질 애플리케이션 코드 변경이 없어 독스트링/README/API문서/CHANGELOG 관점에서는 해당 사항이 거의 없다(CHANGELOG.md 는 실제 코드 동작 변경만 기록하는 기존 관례와 부합 — 이번 변경은 순수 spec 정정·ADR·won't-do 확정이라 항목 추가 불요). 코드 인용(cafe24-token-refresh worker 정책 등)을 직접 대조한 결과 spec 서술과 실제 코드·테스트가 정확히 일치했고, 앞선 3라운드 consistency-check 가 지적한 WARNING(수치 화석 잔존, plan stale 서술, Rationale anchor taxonomy 파편화 등)이 최종 커밋 diff 에서 거의 전부 해소된 것을 재확인했다 — 문서화 품질이 전반적으로 우수하다. 유일하게 남은 아쉬움은 `spec/0-overview.md` §6.1 표에 병기된 "485"/"161" 수치가 형제 위치들과 달리 날짜·SoT 주석을 갖지 않아, 이번 정정 사이클이 없애려던 "출처 없는 수치" 패턴의 씨앗이 한 곳 남아 있다는 점(INFO)과, `spec-impl-evidence.md`의 신규 정정 서술이 문서 자체의 Rationale 인덱스 관례(R-1~R-10)와 완전히 합류하지 않은 점(INFO)이다. 둘 다 저비용·비차단.

### 위험도
LOW