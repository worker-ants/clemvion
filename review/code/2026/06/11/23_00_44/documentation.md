# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: HTTP Request SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**파일 수**: 33개 (구현 2, 테스트 1, plan 2, spec 4, review/* 24)

---

## 발견사항

### - **[WARNING]** `HTTP_BLOCKED` enum 등재는 되었으나 JSDoc/인라인 주석 누락
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` — 신규 추가된 `HTTP_BLOCKED: 'HTTP_BLOCKED'` 항목
- 상세: 새로 추가된 `HTTP_BLOCKED` 항목에는 `// SSRF block (private/loopback/link-local/CGNAT target ...)` 인라인 주석이 포함되어 있어 기본 설명은 제공된다. 그러나 주석이 `(refactor 04 C-3)` 참조만 있고 실제 차단 범위(RFC1918, link-local 169.254.0.0/16, CGNAT 100.64.0.0/10, IPv6 ULA)를 모두 나열하지는 않는다. `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX` 등 인접 코드들과 비교했을 때 주석 수준이 다소 장황하다는 것은 아니나, 차단 대상 주소 범위가 핸들러 코드와 enum 두 곳에 서로 다른 수준으로 서술되어 독자가 단일 SoT를 파악하기 어렵다.
- 제안: `error-codes.ts`의 `HTTP_BLOCKED` 주석을 `// SSRF block — private/loopback/link-local/CGNAT/IPv6-ULA 대상 또는 redirect-hop/non-http(s) scheme. 전 인증 방식 공통. 상세: http-safety.ts` 처럼 SoT 참조를 명시. 현재 `(refactor 04 C-3)` 참조는 내부 이슈 트래킹 번호로 외부 독자에게 불투명하다.

### - **[WARNING]** `http-request.handler.ts` configEcho 명시 열거 블록에 인라인 주석이 충분하나, 스키마 변경 시 유지보수 위험 안내 누락
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — 새로운 `configEcho` 명시 열거 블록 (diff line +198~+211)
- 상세: 코드 상단 블록 주석에 "Principle 7 (D1) — echo by explicit field enumeration"을 설명하고 있어 이유 문서화는 적절하다. 그러나 열거 필드 목록이 `http-request.schema.ts` 의 스키마 필드에서 수동으로 파생된 것임을 명시하지 않아, 이후 스키마에 비민감 필드가 추가될 때 이 열거 목록도 함께 갱신해야 한다는 사실을 독자가 놓치기 쉽다. 현재 주석의 "adding a new schema field is automatically echoed without a maintenance step here (review W-6)" 문구는 해당 줄이 삭제되면서 이제 부정확한 설명이 되었다(spread에서 열거 방식으로 변경되었으므로 자동 반영 불가).
- 제안: configEcho 블록 직전 주석에서 "adding a new schema field is automatically echoed without a maintenance step here" 구절을 제거하거나 반대로 수정하여 "새 비민감 스키마 필드 추가 시 이 열거 목록에도 명시 추가 필요 (http-request.schema.ts 동기화)" 임을 명시한다.

### - **[WARNING]** SSRF 가드 이동 후 기존 주석의 정반대 진술 존재
- 위치: `http-request.handler.ts` diff — 삭제된 주석 블록 (line -219~-222)
- 상세: 기존 주석 "SSRF guard for Integration-backed calls only. Un-authenticated HTTP requests (authentication=none / custom) may legitimately target internal services in some deployments, so we don't block those here."가 삭제되고 새 주석으로 대체된 것은 올바르다. 그러나 새 주석(line +222~+228)에서 "이전엔 hostname literal 검사만 했기 때문에 공격자가 통제하는 DNS가 ... 무방어였다 (W-4)"라는 한국어 혼용 문장이 포함되어 있다. 나머지 주석이 영어와 한국어를 혼용하는 패턴을 따르는지 확인이 필요하고, 특히 "(W-4)" 참조가 어느 이슈/문서를 가리키는지 외부 독자에게 불투명하다.
- 제안: "(W-4)" 참조를 제거하거나 구체적인 위협 시나리오 명칭(예: "DNS rebinding attack")으로 대체한다. 내부 검토 태그를 production 코드 주석에 포함하지 않는다.

### - **[INFO]** `plan/in-progress/http-ssrf-all-auth.md` — 운영 영향 breaking change 섹션이 plan 문서에만 있고 PR 본문 기재 여부 미확인
- 위치: `plan/in-progress/http-ssrf-all-auth.md` 하단 `⚠️ 운영 영향` 경고 블록
- 상세: plan 문서에 breaking change 경고가 상세히 서술되어 있고 `## Rationale`도 충분히 작성되어 있다. 이 breaking change 내용(none/custom 인증으로 사설망 호출 시 기본 HTTP_BLOCKED)이 PR 본문과 릴리스 노트에 동기화될 것을 plan 체크리스트가 명시하고 있다(`- [ ] /ai-review + fix` 단계). 현재 plan에서 PR 본문·릴리스 노트에 명시 의무만 기재되어 있고 실제 기재 여부는 이후 단계이므로 지금 시점의 INFO이다.
- 제안: PR 머지 전 PR 본문에 breaking change 블록(migration 방법: `ALLOW_PRIVATE_HOST_TARGETS=true` 설정)이 포함되었는지 확인한다. CHANGELOG가 관리되고 있다면 이 변경도 등재 대상이다.

### - **[INFO]** `spec/4-nodes/4-integration/1-http-request.md` §8.2 코드 주석 cross-ref 누락
- 위치: `spec/4-nodes/4-integration/1-http-request.md §8.2` — "코드 주석은 '... spec에 근거가 없었고'"
- 상세: §8.2가 "어느 spec에도 근거가 없었다(키워드 검색 0건)"고 기재하나, 해당 근거를 지원하는 구현 파일 주석 제거 사실을 cross-ref하지 않는다. spec 문서 독자가 이 주장을 독립 검증하려면 git history를 직접 확인해야 한다. 이는 rationale continuity 검토에서도 INFO로 지적된 내용이다.
- 제안: §8.2에 "구현 근거 없음 확인: `http-request.handler.ts` 의 해당 주석 제거 (이번 커밋 포함)"를 brief note로 추가하면 후속 독자의 검증 경로가 명확해진다.

### - **[INFO]** `spec/conventions/node-output.md` Principle 3.1 D4 callout — 링크 정확성
- 위치: `spec/conventions/node-output.md` 신규 추가 D4 callout 블록
- 상세: D4 callout이 `([1-http-request.md §5.8](../4-nodes/4-integration/1-http-request.md))` 링크를 포함하고 있다. 이 링크는 파일 경로는 올바르나 anchor(`#` 부분)가 없어 §5.8 위치로 직접 점프하지 못한다. `spec/conventions/`에서 `../4-nodes/4-integration/1-http-request.md`의 상대 경로는 유효하다.
- 제안: 링크를 `([1-http-request.md §5.8](../4-nodes/4-integration/1-http-request.md#58-d4-handlervalidate-실패만-throw-나머지-모두-53으로-라우팅))`처럼 anchor를 포함하도록 보강하면 문서 내비게이션이 개선된다.

### - **[INFO]** 테스트 파일 — 복잡한 보안 로직에 인라인 주석 충분
- 위치: `http-request.handler.spec.ts` — 신규 추가 4개 테스트 케이스
- 상세: 새로 추가된 테스트들은 각각 테스트 목적을 설명하는 주석(`// refactor 04 C-3 — SSRF guard now applies to ALL authentication methods`)과 spec 참조(`// CONVENTIONS Principle 7 D1`)를 포함하고 있어 테스트 문서화는 양호하다. "none 인증 생성 시 Usage 로그 미생성(spec §4.2)" 검증 주석(`expect(logUsage).not.toHaveBeenCalled()` 앞)도 명확하다. 문서화 관점에서 추가 개선이 필요한 부분은 없다.
- 제안: 없음.

### - **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 — 기존 설정 문서에 갱신 필요 가능성
- 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF opt-out callout, `plan/in-progress/http-ssrf-all-auth.md`
- 상세: `ALLOW_PRIVATE_HOST_TARGETS` 환경변수의 적용 범위가 `integration` 인증만에서 전 인증 방식으로 확장되었다. spec 문서(§4 callout)는 갱신되어 "HTTP Request(`none`/`integration`/`custom` 전부)"를 명시한다. 그러나 외부 운영 가이드, 배포 템플릿(docker-compose, Helm values 등)에 이 환경변수가 설명되어 있다면 범위 변경이 반영되어야 한다. 본 리뷰 범위(제공된 diff) 내에서는 확인할 수 없다.
- 제안: 별도 운영 문서(README, deployment guide)에 `ALLOW_PRIVATE_HOST_TARGETS`의 적용 범위가 전 인증 방식으로 확대되었음을 기재하거나, 해당 문서 갱신이 필요함을 PR 체크리스트에 추가한다.

---

## 요약

이번 변경은 보안 관련 breaking change임에도 문서화 품질이 전반적으로 높다. `spec/4-nodes/4-integration/1-http-request.md` §8.2 Rationale은 결정 배경·기각 대안·운영 영향(breaking)·마이그레이션 경로를 모두 갖추고 있으며, `spec/conventions/node-output.md` D4 callout과 `spec/5-system/3-error-handling.md` `HTTP_BLOCKED` 추가도 시스템 문서 동기화가 이루어졌다. 주요 개선 포인트는 두 가지다: (1) `http-request.handler.ts`의 configEcho 블록 주석에 이전 "자동 반영" 설명이 잔존하여 spread에서 명시 열거로 바뀐 것과 모순되는 진술이 있고, (2) 내부 검토 태그 "(W-4)"가 production 코드 주석에 남아 있어 외부 독자에게 불투명하다. `error-codes.ts`의 `HTTP_BLOCKED` 주석은 기능은 하나 SoT 참조가 없어 차단 범위를 파악하려면 별도 파일을 찾아야 한다. spec 변경과 구현 변경 간 문서 일관성은 양호하며, 나머지 발견사항은 INFO 수준의 개선 제안이다.

---

## 위험도

LOW
