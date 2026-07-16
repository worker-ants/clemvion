### 발견사항

- **[WARNING]** `9-rag-search.md` 본문 내부 stale plan 참조 — D1이 승계 근거로 든 항목과 정확히 겹침
  - target 위치: draft D1 (`spec/5-system/9-rag-search.md` frontmatter `pending_plans` 교체 근거)
  - 충돌 대상: `spec/5-system/9-rag-search.md` §3.3.2 (L237, L400 — "D2 escalate 정량 임계 A/B 확정은 후속" 문구)
  - 상세: 두 인용문 모두 여전히 `[rag-rerank-followup.md](../../plan/complete/rag-rerank-followup.md)`(이미 `plan/complete/`로 종결된 파일)를 tracking plan으로 링크하고 있다. 그런데 `rag-rerank-followup.md` 자신의 종결 노트("정량 임계 A/B 는 `rag-quality-improvement.md §7.B`로 이관")와 D1이 새로 설정하려는 `pending_plans`(→ `rag-quality-improvement.md`)는 이미 이 항목이 `rag-quality-improvement.md`로 넘어갔다고 말한다. 즉 frontmatter는 D1로 정합해지지만, 같은 항목을 설명하는 본문 인라인 참조 2곳은 여전히 닫힌 plan을 가리켜 독자를 잘못된 곳으로 안내한다. (이 stale 링크 자체는 draft 도입 이전부터 있었지만, D1이 정확히 이 항목을 근거로 pending_plans를 갱신하면서도 고치지 않는 것은 누락으로 보인다.)
  - 제안: D1에 "L237/L400의 `rag-rerank-followup.md` 참조를 `rag-quality-improvement.md §7.C`로 교체" 항목 추가.

- **[INFO]** 절 단위 won't-do 표기 관례 — 존재하나 비공식, D2에 명시 지침 없음 (draft 검토요청 관점 3에 대한 답)
  - target 위치: draft D2 (변경 2-2/2-3/2-4)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md`(§1.2/§1.3/§4.2/§8, `R-wontdo-rawws-rest`), `spec/5-system/2-api-convention.md:309`, `spec/5-system/14-external-interaction-api.md:72,292`
  - 상세: 이 3개 문서가 이미 `_(비채택 won't-do — <이유>)_` 인라인 표기 + 전용 `### R-wontdo-*` Rationale 절 + "Planned → 비채택 won't-do (날짜)" changelog 라인의 일관된 패턴을 확립해 두었다. 그러나 이 관례는 `spec/conventions/spec-impl-evidence.md` §3/§4에 공식 문서화되어 있지 않다(`archived`는 문서 단위 폐기용이라는 R-4만 있음). D2는 "won't-do 표기로", "won't-do 결정 기록으로 전환" 이라고만 서술해 정확한 표기 스타일을 지정하지 않는다 — draft 자신의 판단("archived와 레이어가 다르다")은 정확하지만, 표기 스타일 자체는 기존 3개 문서 패턴을 따르지 않으면 제4의 ad-hoc 표기가 생길 위험이 있다. (11-mcp-client.md의 기존 Rationale 절은 `R-N` ID를 쓰지 않고 서술형 제목만 쓰므로, `R-wontdo-*` ID까지 맞출 필요는 없지만 인라인 `_(비채택 won't-do — …)_` 브래킷 표기는 맞추는 것이 grep 가능성 면에서 유리.)
  - 제안: D2 변경 2-2/2-3에 `_(비채택 won't-do — <핵심 이유 3어절>)_` 형태의 인라인 표기를 명시하고, 원한다면 spec-impl-evidence.md에 이 관례를 정식 등재(별도 후속 가능).

- **[INFO]** `spec-link-integrity.test.ts`의 실제 동작이 자신의 코드 주석 및 `spec-impl-evidence.md §4.2` "예외" 열과 불일치 — draft의 D3 전제 자체는 안전하지만 근거 문서가 부정확
  - target 위치: draft 배경 섹션 항목 2 ("spec 본문이 plan/... 를 링크하면 spec-link-integrity.test.ts(build 차단)가 깨진다")
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:23` ("Plan-side link hygiene is handled by plan-coherence-checker, not this gate") 및 `spec/conventions/spec-impl-evidence.md §4.2` 표의 `spec-link-integrity.test.ts` 예외 열("plan/ 링크(=plan-coherence 담당)")
  - 상세: 실제 구현(`spec-links.ts` `findBrokenLinks()`)은 `spec/**.md` 소스 스캔에 `targetFilter`를 전혀 적용하지 않는다 — `plan/in-progress/*.md`를 가리키는 상대링크도 다른 링크와 동일하게 `fs.existsSync` 검사 대상이며, 파일이 이동하면 DEAD violation으로 build를 막는다. `targetFilter`(spec/**.md 타깃만 검사)는 코드베이스 `.ts`/`.tsx` 소스 스캔(`findBrokenSpecLinksInSources`)에만 적용된다. 즉 draft가 전제한 "build 차단" 결과는 **실제로 맞다**(D3를 반드시 진행해야 함은 맞음). 다만 이를 뒷받침하는 컨벤션 문서(`spec-impl-evidence.md §4.2`)와 테스트 자체 주석은 "plan/ 링크는 이 게이트 범위 밖"이라고 잘못 서술하고 있어, 다음에 이 문서만 읽고 판단하는 사람은 반대로 오판할 수 있다.
  - 제안: 이번 draft 범위는 아니지만, 별도 후속으로 `spec-impl-evidence.md §4.2` 표의 예외 서술과 `spec-link-integrity.test.ts:23` 주석을 실제 구현에 맞게 정정(plan/ 링크도 스캔 대상임을 명시) 권장.

- **[INFO]** `spec/4-nodes/1-logic/10-parallel.md` 동시 편집 — 섹션 분리로 직접 충돌은 없음
  - target 위치: draft D3 (L211, L230 경로 갱신 + §2-E stale 앵커 정정)
  - 충돌 대상: `plan/in-progress/node-output-redesign/parallel.md` (같은 파일의 §3/§5.1/§5.2/§5.7, L74·L101-130·L143 — `branches[i]` envelope shape의 spec-vs-impl CRITICAL 불일치를 별도로 추적 중)
  - 상세: 두 변경 모두 `10-parallel.md`를 건드리지만 섹션이 분리되어 있어(D3는 Rationale 인접부의 waitAll/중첩 결정 서술, node-output-redesign은 §3/§5 출력 스키마) 내용 충돌은 없다. 다만 같은 파일을 병행 수정 중인 두 트랙이므로 머지 순서/라인 드리프트에 유의할 필요는 있다.
  - 제안: 별도 조치 불요, 참고 사항으로 기록.

- **[INFO]** D2의 "implemented 승격이 다른 영역과 충돌하는가" — 확인 결과 충돌 없음
  - target 위치: draft 검토 요청 관점 1
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1(L485-553, `mcpDiagnostics` 예시/필드 표), `spec/2-navigation/4-integration.md`(§5.6, §9.1, §14 등 mcp-client 상호참조 지점)
  - 상세: 두 문서 모두 이미 구조화된 `mcpDiagnostics` shape(`serverSummaries[]`/`errors[]` 포함)를 반영하고 있고, `cached_capabilities`/`spec-sync-mcp-client-gaps` 참조는 어디에도 없다 — D2가 §3.3·§6.2(L371)만 건드리면 다른 두 문서와 정합이 유지된다. `plan/complete/spec-sync-mcp-client-gaps.md` 자체도 동일한 종결 결정(§3.3 won't-do + status 승격)을 이미 선언해 두어 D2와 완전히 부합한다.
  - 제안: 없음(확인 완료로 기록).

### 요약

D1(rag-search pending_plans 재배선)·D2(mcp-client won't-do + 승격)·D3(parallel-p2-followups 경로 갱신) 세 변경 모두 사실관계(라인 번호, plan 상태, 인용문, 테스트 존재 여부 등 15건 이상)를 개별 검증했으며 전부 정확했다. 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 어느 축에서도 다른 영역과의 직접 모순은 발견되지 않았고, `ai-agent.md`/`integration.md`의 mcpDiagnostics 서술도 이미 D2와 정합한 상태다. 유일한 실질적 갭은 D1이 근거로 든 4개 미구현 표면 중 하나(D2 escalate 정량 임계 A/B)를 설명하는 `9-rag-search.md` §3.3.2의 인라인 plan 참조 2곳이 이미 종결된 `rag-rerank-followup.md`를 계속 가리켜, D1의 frontmatter 갱신과 본문이 서로 다른 plan을 지목하게 되는 점이다(WARNING). 그 외에는 won't-do 표기 스타일 통일 권장, `spec-link-integrity` 가드 문서-코드 불일치(이 draft와 무관한 기존 결함이지만 D3의 핵심 근거이므로 병기), `10-parallel.md` 동시 편집 인지 정도의 저위험 INFO 항목뿐이다.

### 위험도
LOW