# Plan 정합성 검토 — `plan/in-progress/spec-draft-integration-error-facts.md` (2차)

## 발견사항

- **[INFO]** 리다이렉트 홉의 `HTTP_TRANSPORT_FAILED` 행이 "가드의 고장" 트리거를 명시적으로 담지 않는데 target 이 "이미 덮는다"고 적는다
  - target 위치: `## 변경안 ②` 마지막 괄호 — "(홉 쪽은 기존 `HTTP_TRANSPORT_FAILED` 행이 이미 덮는다.)"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크박스 「**가드 고장이 preflight 냐 리다이렉트 홉이냐에 따라 다른 코드로 나간다 — 그 경로의 회귀 테스트도 없다**」(developer, open, `[ ]`)
  - 상세: 실재 `spec/4-nodes/4-integration/1-http-request.md:337` 의 `HTTP_TRANSPORT_FAILED` 행 조건은 "`fetch` reject (DNS / 연결 거부 / 소켓 / `AbortController` timeout)" 로, 네트워크 계층 실패만 명시한다 — "SSRF 가드가 판정 아닌 오류를 던져 전송 catch 로 떨어진 경우"는 그 문구 어디에도 없다. 코드 경로상으로는 같은 catch 로 수렴해 같은 코드가 나가는 것이 사실이지만(target 의 실측이 맞음), target 자신이 이 draft 의 존재 이유로 든 근거("표가 그 구분을 담지 않으면 다음 사람이 «가드 실패 = 차단» 으로 되돌린다", `## Rationale`)가 이 행에는 적용되지 않은 채로 남는다. 다만 이 문구 보강은 트래커의 위 열린 항목(코드 통일 여부 결정)이 어차피 손대야 할 자리이므로, target 이 `## 비대상`에서 "두 시점을 통일할지는 트래커의 열린 항목이 정하도록 포인터만 남긴다"고 선언한 것과 방향은 일치한다 — 새로 만들어야 할 후속 작업이라기보다는, 그 열린 항목이 처리할 때 "행 문구에 트리거를 명시" 도 함께 챙겨야 한다는 점을 아직 어디에도 적어두지 않았다는 잔여 갭이다.
  - 제안: 이번 draft 를 막을 사유는 아니다. `## 비대상` 또는 트래커 항목(4944행)에 "코드 통일 여부와 별개로, `HTTP_TRANSPORT_FAILED` 행 문구에 '리다이렉트 홉에서 가드가 판정 아닌 오류를 던진 경우' 트리거를 추가하는 것도 이때 함께 처리" 라는 한 구절을 남겨 두면 다음 착수자가 "코드는 안 바꾸기로 했으니 문서도 그대로 둔다" 로 오독하는 것을 막을 수 있다.

- **[INFO]** `1-http-request.md` frontmatter `code:` 편입이 별도 진행 중인 가드 파일 이동 계획과 다시 부딪힐 수 있음 (1차 검토 INFO 유지)
  - target 위치: `## 변경안 ① 1-http-request.md frontmatter code:`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크박스 「**공용 SSRF 가드 `http-safety.ts` 를 `http-request/` 밖 중립 위치로**」(planner+developer, open) — "옮기면 `1-http-request.md` frontmatter `code:` 경로를 함께 바꿔야 한다"고 이미 예고돼 있다
  - 상세: 지금 추가하는 `http-redirect.ts` 경로는 현재 구현 위치 기준으로 정확하다. 다만 그 이동 항목이 나중에 실행되면 이번에 추가하는 항목을 포함해 `code:` 리스트 전체를 다시 편집해야 한다 — 충돌은 아니고 예정된 재작업.
  - 제안: 별도 조치 불필요. 이동 항목 실행자가 그 시점에 `http-redirect.ts` 도 재조정 범위에 있음을 인지하면 충분.

## 요약

1차 검토(`review/consistency/2026/09/20/15_43_51`)가 지적한 CRITICAL — 변경안 ②가 `1-http-request.md §4.2` 에 단계 구분 없는 "가드 고장 → `INTEGRATION_CALL_FAILED`" 행을 넣어 트래커의 열린 developer 결정(홉/preflight 코드 통일 여부, `spec-draft-nullable-notation-followups.md` 「가드 고장이 preflight 냐 리다이렉트 홉이냐…」)을 암묵적으로 선취하던 문제 — 는 이번 개정에서 해소됐다. 실측표로 preflight(`INTEGRATION_CALL_FAILED`)와 리다이렉트 홉(`HTTP_TRANSPORT_FAILED`)을 명시적으로 분리했고, `0-common.md §4.2` 문구도 "노드별 시점 차이는 각 문서를 본다"로 일반화를 피했으며, `1-http-request.md` 쪽 §4.2 신설 행도 "step 8 preflight" 로 범위를 한정하고 통일 여부는 트래커에 포인터만 남겼다. `## 비대상` 서술과 `## 변경안` 이 이제 서로 모순되지 않는다. 다른 세 항목(①③④)은 여전히 근거·변경안이 구현·트래커의 해당 planner 체크박스(2건: `http-redirect.ts` 증거 누락 + 가드 고장 트리거, HTTP 연결 테스트 두 코드 + MakeShop §5.9 범위 축소)와 정확히 대응하고, 트래커의 다른 열린 항목(§3.1 실행 실패 분류표 등 제품 판단 필요 항목, 가드 고장 메시지 마스킹 정책)은 `## 비대상`에 명시적으로 배제해 두어 충돌이 없다. 잔여 INFO 둘은 모두 비차단 — 하나는 트래커 항목이 해소될 때 함께 챙길 문구 보강 메모, 다른 하나는 1차 검토에서 이미 비차단으로 판단된 frontmatter 재작업 예고다.

## 위험도
LOW
