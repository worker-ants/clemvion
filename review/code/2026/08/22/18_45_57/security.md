# 보안(Security) 코드 리뷰

## 범위 확인

이 변경 세트의 24개 파일은 전부 `plan/**`, `review/consistency/**`, `spec/**` 아래의 `.md`/`.json` 문서다. `codebase/**` 아래의 실제 애플리케이션 코드(TypeScript 등)는 **한 줄도 변경되지 않았다**. 즉 이번 diff 는 기존에 이미 구현·배포된 egress 마스킹 로직(`@workflow/masked-markers`, `sanitize-error-message.ts`, `strip-external-only-fields.ts`, `websocket.service.ts`, `reject-masked-resubmission.ts`, frontend `masked-markers.ts`)의 동작을 **문서화**하는 작업이며, 그 로직 자체를 신설·수정하지 않는다. 따라서 인젝션·인증/인가·암호화·의존성 등 코드 실행 경로에 대한 신규 취약점은 이 diff 로 도입될 수 없다.

## 발견사항

- **[INFO]** 신설 문서가 마커 리터럴 값을 의도적으로 배제하고 이름으로만 참조
  - 위치: `spec/conventions/egress-masking.md:34` (`> **본 문서는 마커 리터럴을 적지 않는다.**`)
  - 상세: `VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER` 등 마스킹 마커의 실제 문자열 값을 문서에 적지 않고 이름으로만 인용한다. 마스킹 마커 리터럴이 여러 문서에 흩어져 미러링되면, 공격자가 마커 값을 추정해 "이미 마스킹된 것처럼 보이는" 페이로드를 만들어 재마스킹/검증 로직을 우회할 여지가(예: 클라이언트가 임의로 마커 문자열을 흉내 내 제출) 이론적으로 존재한다(관련 통제: `reject-masked-resubmission.ts`, `hasMaskedLeaf`/`hasMaskedMarkerLeaf`). 이 리터럴 비공개 방침은 그 표면을 넓히지 않는 방향으로, 오히려 방어적이다. 단순 참고 사항으로 기록.
  - 제안: 조치 불필요. 현행 방침 유지 권장.

- **[INFO]** 문서가 스스로 "off-by-one = fail-open" 위험을 명시적으로 기록
  - 위치: `spec/conventions/egress-masking.md` §1.1 (`### 1.1 값이 같다고 같은 상한이 아니다`)
  - 상세: `MAX_REDACT_DEPTH`(`depth >= N`, backend)와 `MAX_SANITIZE_DEPTH`(`depth > N`, WS)의 경계 연산자가 다르고, frontend 스캐너(`hasMaskedMarkerLeaf`)가 "깊이 검사보다 값 검사를 먼저" 하는 이유를 "깊이 검사를 먼저 하면 그 자리의 마커를 검사도 없이 지나친다(off-by-one = fail-open)"고 명시했다. 이는 실제 코드의 기존 동작을 설명하는 것으로, 이번 PR 이 그 위험을 새로 만든 것이 아니라 **이미 존재하는 fail-open 잠재 지점을 문서화해 향후 회귀를 방지**하는 효과가 있다. 오히려 보안 관점에서 유익한 변경.
  - 제안: 조치 불필요. 다만 이 캐비엇이 언급하는 backend `hasMaskedLeaf`(`reject-masked-resubmission.ts`)의 실제 연산자 순서(값 검사 우선 여부)가 frontend 와 동일한지는 이번 문서만으로 확인되지 않는다 — 코드 레벨 검증은 이번 세션 범위 밖(순수 문서 diff)이므로 별도 확인 권장.

- **[INFO]** `AuthConfig.config` 필드 마스킹(`1-data-model.md §2.17.2`, 별도 보안 통제)과의 스코프 분리를 명시적으로 캐비엇
  - 위치: `spec/conventions/egress-masking.md:30` (`> **비대상 — AuthConfig.config 필드 마스킹**`)
  - 상세: 두 마스킹 메커니즘(egress 값-패턴 마스킹 vs 저장된 자격증명의 필드 단위 마스킹)이 이름 유사성으로 혼동될 수 있음을 문서가 스스로 경계 지었다. 보안 문서 관점에서 SoT 혼동을 예방하는 바람직한 조치.

## 요약

이번 변경은 `codebase/**` 를 전혀 건드리지 않는 순수 문서/계획(plan) 아티팩트 커밋으로, 새로운 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지 않은 암호화 등 실행 코드 취약점을 도입할 표면이 없다. 신설되는 `spec/conventions/egress-masking.md` 는 기존에 코드 JSDoc 에만 흩어져 있던 egress 마스킹 좌표계(깊이 상한·경계 연산자·마커 소비처)를 정본화하는 문서이며, 마커 리터럴 비공개·off-by-one fail-open 위험 명시·별개 마스킹 메커니즘과의 스코프 분리 캐비엇 등 오히려 보안 통제의 정확성과 향후 회귀 방지에 기여하는 내용으로 평가된다. 하드코딩된 시크릿, 평문 전송, 안전하지 않은 해시 등은 diff 전체에서 발견되지 않았다.

## 위험도
NONE
