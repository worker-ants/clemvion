## 발견사항

- **[INFO]** `auth-config-webhook-followups.md §3` 미체크 항목이 target 변경으로 사실상 해소됨
  - target 위치: `spec/1-data-model.md` §2.17 `ip_whitelist` 행 (저장 시 IP/CIDR 형식 검증 + 400 거부 구문 추가)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §3 라인 55 — "IP whitelist CIDR/IPv6 지원 여부 명시 (현재 구현은 exact match)"
  - 상세: `auth-config-webhook-followups.md §3` 의 미체크 항목은 "현재 구현이 exact match" 라는 전제 하에 CIDR/IPv6 지원 여부를 spec 에 명시해달라는 요청이었다. 이번 target 변경(`1-data-model.md`)은 `ip_whitelist` 설명에 "단일 IP 또는 CIDR 표기(IPv4·IPv6)" 를 명시했고, 백엔드 구현도 `ip-address(Address4/Address6)` 라이브러리로 CIDR 를 실제 검증한다. 즉 `auth-config-webhook-followups.md §3`의 "IP whitelist CIDR/IPv6 지원 여부 명시" 항목은 이번 spec 갱신으로 해소됐으나, plan 문서에는 체크가 달리지 않아 추적이 누락된 상태다.
  - 제안: `plan/in-progress/auth-config-webhook-followups.md` §3 의 해당 항목을 체크 처리하거나 해소 근거(본 PR spec 변경)를 주석으로 추가한다.

- **[INFO]** `auth-config-webhook-followups.md §3` 의 나머지 spec 보완 항목은 이번 변경과 무관하게 미착수 상태
  - target 위치: 해당 없음 (이번 target 변경이 다루지 않는 범위)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §3 라인 51–54 — `reveal` 엔드포인트 API 표 추가, IP 추출 정책 명시, secret-store 키 재사용 메모, 공개 webhook regenerate 경고
  - 상세: 위 4개 항목은 이번 C-2 변경 범위(`1-data-model.md ip_whitelist 검증`, `6-config.md autoclear 정책`)와 직교하며 충돌하지 않는다. 다만 `auth-config-webhook-followups.md §2~4` 가 "미착수 잔여" 로 명시된 상태인데, 해당 plan 의 `worktree`(`audit-coverage-naming`) 에서 §1 만 완료되고 §2~4 는 아직 착수되지 않았음. 이번 변경이 이 plan 의 후속 진행을 막지는 않는다.
  - 제안: 해소된 §3 CIDR/IPv6 항목과 아직 미착수인 나머지 §3 항목을 구분하여 plan 가독성을 높인다.

- **[INFO]** `spec-sync-config-gaps.md` 후속 — God Component 분리 항목은 여전히 미착수이며 이번 변경과 충돌 없음
  - target 위치: 해당 없음
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` "후속 — God Component 분리" `[ ]` 항목
  - 상세: 이번 C-2 변경은 `authentication/page.tsx` 의 `generatedKey` autoclear 로직과 `ipWhitelist` DTO 검증을 추가했으나, God Component 분리(component 단위 리팩토링)와는 scope 가 다르다. 충돌 없음. 분리 작업은 이번 PR 병합 후 별도 진행 가능.
  - 제안: 추적 목적으로만 언급; 별도 조치 불요.

---

## 요약

이번 C-2 구현(generatedKey 30초 자동클리어 + ipWhitelist 저장 시 IP/CIDR 검증)은 `spec-sync-config-gaps.md` 에 등록된 범위 내 작업이며, plan 에서 "결정 필요"로 남겨진 항목을 일방적으로 결정하는 충돌은 없다. 다만 `auth-config-webhook-followups.md §3` 의 "IP whitelist CIDR/IPv6 지원 여부 명시" 미체크 항목이 이번 spec 갱신으로 사실상 해소됐음에도 plan 문서에 반영되지 않아 추적 누락이 생겼다. 이 외에 선행 plan 미해소나 후속 항목 무효화 문제는 발견되지 않았다.

---

## 위험도

LOW
