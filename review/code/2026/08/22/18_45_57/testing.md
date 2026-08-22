# 테스트(Testing) 리뷰 — egress-masking-convention

## 범위 확인

이번 diff 24개 파일 전부가 `plan/**`(2) · `review/consistency/**`(18, JSON/MD 산출물) · `spec/5-system/**`(2) ·
`spec/conventions/**`(2) 이며, `codebase/**` 아래 애플리케이션 코드·테스트 파일은 **한 줄도 포함되지 않는다**.
즉 이번 PR 은 `@workflow/masked-markers` / `sanitize-error-message.ts` / `strip-external-only-fields.ts` /
`websocket.service.ts` / `reject-masked-resubmission.ts` / `frontend masked-markers.ts` 에 이미 존재하는
불변식(깊이 상한 3계열·경계 연산자·마커 3종)을 **새 conventions 문서로 승격**만 하는 spec-draft 작업이다.
따라서 "테스트 존재 여부/커버리지 갭/Mock/격리/가독성/테스트 용이성" 관점은 원칙적으로 해당 사항이 없고,
검토는 (a) 새 문서가 코드에 대해 하는 **사실 주장이 기존 테스트로 실제 뒷받침되는가**, (b) 새 문서 추가가
**기존 문서 가드 테스트를 깨지 않는가** 두 축으로 수행했다.

## 실측 검증

1. `spec/conventions/egress-masking.md` (파일 23) 의 `code:` frontmatter 6개 파일에 전부 대응하는 spec 파일이
   실재한다: `masked-markers/src/__tests__/index.spec.ts`, `sanitize-error-message.spec.ts`(×2, shared/backend
   양쪽), `strip-external-only-fields.spec.ts`, `websocket.service.spec.ts`, `reject-masked-resubmission.spec.ts`,
   `masked-markers.test.ts`(frontend). 문서가 인용하는 6개 소비처 심볼 전부 테스트 파일을 갖는다.
2. 새 문서 §1 "값이 같다고 같은 상한이 아니다"(egress-masking.md 58-62행, off-by-one fail-open 주장)는
   `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` 의 `hasMaskedMarkerLeaf` 스위트가
   `nest(10, "***") → true` / `nest(11, "***") → false` 로 정확히 경계를 고정하고 있어 실제로 뒷받침된다
   (해당 테스트 자체에 "값 검사가 깊이 검사보다 먼저여야 통과" 주석까지 있음).
3. §2 "마스킹은 한 번"(egress-masking.md 66-76행)의 "`deepRedactObject` 는 이미 마커면 덮지 않는다" 주장은
   `sanitize-error-message.spec.ts` 의 `isMaskedMarker` 단언(34·43-44행)과 idempotency 테스트
   (`is idempotent across repeated calls`, 160행)로 뒷받침된다. "`attachRoutingContext` 가 붙인 `chatChannel`
   의 키-마커를 덮지 않는다" 주장도 `websocket.service.spec.ts` 의
   `'credential-shape 키가 chatChannel 안에 있으면 sanitize 가 마스킹 (defense in depth)'` 테스트가
   `chatChannel.api_key === '[REDACTED]'`(KEY_MASK_MARKER, VALUE_MASK_MARKER 아님) 로 고정하고 있어 일치한다.
4. 회귀 확인 — 새 문서 4개(`plan` 2 + `spec/conventions` 1 신설 + `spec/5-system` 2 수정)가 기존 문서 가드
   테스트를 깨지 않는지 직접 실행:
   `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-links.test.ts` / `plan-frontmatter.test.ts`
   4개 파일, **960 tests 전부 PASS**. `code:` glob 6개 경로 매치·`id`/`status` 유효성·plan frontmatter
   (`worktree`/`started`/`owner`/`spec_impact` 리스트) 모두 가드를 통과한다.

## 발견사항

- **[INFO]** "마스킹은 한 번" 불변식의 cross-path 검증 갭이 문서 자신에 의해 이미 열려 있다 (테스트 부재를 이 PR 이 새로 만든 것이 아니라 정직하게 노출)
  - 위치: `spec/conventions/egress-masking.md:75` (§2, "이 순서 계약이 확인된 범위는 `toFanoutEnvelope` 경로다")
  - 상세: `TerminalErrorPayload` 를 채우는 모든 호출부가 `sanitizeErrorMessage` 를 경유하는지는 현재
    테스트로 전수 확인되지 않았고, 문서도 이를 명시적 caveat 로 인정하며 형제 plan
    `plan/in-progress/ws-event-types-extract.md` 의 미체크(`[ ]`) 항목으로 추적을 남겼다. 즉 실제 코드의
    테스트 커버리지 갭(`toFanoutEnvelope` 외 경로)은 존재하지만, 이 PR 의 책임 범위가 아니며 은폐하지 않고
    범위를 좁혀 정직하게 문서화했다 — "문서한 보장이 구현보다 넓으면 안 된다" 원칙에 부합.
  - 제안: 조치 불요(이 PR 범위). `ws-event-types-extract.md` 해당 항목 착수 시 개발자가 전수 확인 테스트를
    추가하고, 통과 후 이 caveat 문구를 걷는 후속 작업으로 남겨 둔다.

- **[INFO]** 문서가 스스로 "기계 강제 없음"을 명시하고 그 근거(무한 표면 회피)를 Rationale 에 남겼다 — 재지적 불필요
  - 위치: `spec/conventions/egress-masking.md:79-83` (§3 "이 문서는 기계가 지키지 않는다"), Rationale 마지막
    기각 대안 ("좌표계를 기계가 검사하게 한다")
  - 상세: 좌표계 표(값·연산자·마커·소비처)가 실제 소스와 어긋나도 잡아줄 자동 테스트/가드가 없다. 이 저장소는
    유사 트레이드오프(정밀 파서 vs blind 정규식)를 이미 결론 낸 선례가 있고, 이 문서가 그 유비를 그대로
    원용해 "표를 파싱해 소스와 대조하려면 TS AST 파서가 필요하다"는 근거로 명시적으로 won't-do 처리했다.
    테스트 리뷰어 입장에서 이를 새 CRITICAL/WARNING 으로 재지적하는 것은 이미 검토·기각된 결정의 반복
    재지적에 해당하므로 승격하지 않는다.
  - 제안: 조치 불요. 알려진 stale 트리거(정본 트래커 W4 통합)가 실제로 착수될 때 표 동반 갱신 여부를
    후속 리뷰에서 확인하는 정도로 충분하다.

- **[INFO]** 이번 diff 에 신규/변경 테스트 파일이 전혀 없음 — 정상(문서 전용 diff)
  - 위치: 전체 24개 변경 파일(`plan/**`, `review/consistency/**`, `spec/**`) — 게이트 인용 불필요, 파일
    유형 자체가 근거
  - 상세: 애플리케이션 코드 변경이 없으므로 새 단위/통합/e2e 테스트가 필요하지 않다. 문서가 인용하는 6개
    소스 파일은 모두 기존 `.spec.ts`/`.test.ts` 를 이미 보유하고 있고(위 "실측 검증" §1), 그 테스트들이
    문서의 핵심 기술 주장(깊이 경계·마커 idempotency·chatChannel 키-마커 보존)을 실제로 고정하고 있음을
    직접 열어 확인했다.
  - 제안: 없음.

## 요약

이번 변경은 `codebase/**` 를 건드리지 않는 spec-draft 승격 PR 이라 전통적인 "테스트 커버리지 갭" 질문 자체가
성립하지 않는다. 대신 신설 `spec/conventions/egress-masking.md` 가 코드에 대해 내리는 구체적 기술 주장
(깊이 상한 `10`, `>=` vs `>` 경계, `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 마커 3종, 재마스킹
멱등성, off-by-one fail-open 방지 순서)이 실제로 존재하는 기존 테스트(`masked-markers` 패키지 spec,
`sanitize-error-message.spec.ts`, `websocket.service.spec.ts`, frontend `masked-markers.test.ts`)로 뒷받침되는지
직접 코드를 열어 대조했고 전부 일치를 확인했다. 문서 신설이 4개 기존 doc-guard 테스트(`spec-frontmatter`·
`spec-code-paths`·`spec-links`·`plan-frontmatter`, 총 960 tests)를 깨지 않는 것도 직접 실행해 확인했다. 유일하게
남는 테스트 갭(`TerminalErrorPayload` 전 경로의 `sanitizeErrorMessage` 경유 여부 미확인)은 이 문서가 스스로
범위를 좁혀 정직하게 caveat 로 남기고 형제 plan 에 추적 항목까지 걸어 두었으므로 이 PR 을 막을 사유가 아니다.

## 위험도
LOW
