# Rationale 연속성 검토 결과

## 검토 대상
- 모드: --impl-prep, scope=`spec/5-system/`
- payload 구성: `spec/5-system/1-auth.md` 전문(§1.5 초대 토큰 흐름 포함, Rationale 1.5.A~D 포함) + `spec/5-system/10-graph-rag.md` 전문 + 다수 타 spec 문서(`0-overview.md`, `1-data-model.md`, `2-navigation/*`)의 `## Rationale` 섹션 발췌.
- 작업명(`invite-accept-confirm-ui`)에 비춰 실질 관련 영역은 `1-auth.md §1.5`(초대 토큰 흐름)이며, `10-graph-rag.md`와 dashboard/workflow-list/trigger-list/integration 등 대부분의 Rationale 발췌는 이번 작업과 직접 관련이 없다.

## 발견사항

### [INFO] target payload에 이번 변경(diff) 자체가 포함되어 있지 않음
- **target 위치**: payload 전체 — `spec/5-system/1-auth.md` §1.5 전문(현재 baseline)만 포함
- **과거 결정 출처**: 해당 없음 (구조적 관찰)
- **상세**: 작업명이 "invite-accept-confirm-ui"임에도 payload에는 `1-auth.md`의 현재 상태(§1.5 초대 흐름 + Rationale 1.5.A~D)만 실려 있고, 이번에 신규 도입/변경하려는 "수락 확인(confirm) UI" 자체의 변경 문구·신규 API·신규 화면 상태는 어디에도 나타나지 않는다. 대신 이번 작업과 무관한 `10-graph-rag.md` 전문과 dashboard·workflow-list·trigger-list·integration 등 다수 spec의 Rationale 발췌가 함께 실려 있다. Rationale 연속성 검토는 본질적으로 "과거 결정(before) vs 신규 target(after)"의 대조인데, before만 있고 after가 없어 실질적인 충돌 여부를 판정하기 어렵다.
- **제안**: 이번 턴에 실제로 추가/수정하려는 초대 수락 확인 UI 관련 신규 spec 문구(예: `2-navigation/9-user-profile.md §4.1.1` 확장, 신규 navigation 화면 spec, 또는 `1-auth.md §1.5.3` 개정안)를 별도로 payload에 포함해 재검토할 것을 권고한다.

### [INFO] `spec/2-navigation/9-user-profile.md`의 인접 Rationale이 payload에서 누락
- **target 위치**: payload 전체 (해당 문서 미포함)
- **과거 결정 출처**: `spec/2-navigation/9-user-profile.md` `## Rationale` — "`/profile` 편집 인터랙션의 분리 (§2)": 고위험 동작(비밀번호·이메일 변경)은 별도 sub-route 진입 자체로 의도를 표명하게 하고, 저위험 항목은 인라인 토글 + diff 확인 모달로 처리한다는 원칙. 및 동 문서 §4.1.1(초대 발송/재발송/취소 UI, "대기 중 초대" 표시).
- **상세**: 초대 accept 화면의 세부 흐름은 `1-auth.md §1.5.3`(가입한 사용자가 다른 워크스페이스에 초대된 경우)가 정의하지만, "confirm UI"가 어느 수준의 마찰(별도 확인 모달 유무 등)을 적용해야 하는지는 `9-user-profile.md`의 위험도별 마찰 원칙과 대조해야 판단 가능하다. 이 문서가 payload에 없어 신규 confirm UI가 그 원칙, 그리고 Rationale 1.5.A(이메일 prefill+readOnly로 "정상 사용자 UX 마찰 최소화")의 의도와 정합하는지 본 검토 범위에서 확인하지 못했다.
- **제안**: 초대 수락 confirm UI 설계 시 `9-user-profile.md`의 "고위험=sub-route/확인 vs 저위험=인라인" 원칙과 대조하고, 신규 confirm 단계가 Rationale 1.5.A가 이미 명시한 "마찰 최소화" 의도를 다시 위반(과도한 재확인 단계 추가 등)하지 않는지 별도로 점검할 것을 권고한다.

## 자기정합성 확인 (참고, 문제 없음)

payload에 포함된 `1-auth.md §1.5` 본문(초대 토큰 흐름)은 자기 자신의 Rationale과 완전히 일치하며 기각된 대안의 재도입은 발견되지 않았다:

- §1.5.2/1.5.3의 "이메일 일치 강제"는 Rationale 1.5.A와 일치. 기각된 대안(옛+신규 둘 다 인증 확인)이 재도입되지 않음.
- §1.5.1 "시스템 전역 SMTP만 사용"은 Rationale 1.5.B와 일치. 워크스페이스 SMTP Integration 사용 안(기각된 대안)이 재도입되지 않음.
- §1.5.1 "토큰을 raw로 DB 저장"은 Rationale 1.5.D와 일치하며, §1.1의 이메일 인증/비밀번호 재설정 토큰이 SHA-256 해시로 저장되는 것과 의도적으로 대비되는 이유(위협 모델 차이)가 이미 명문화되어 있다.
- §1.5.4의 `lower_snake_case` 에러 코드는 `error-codes.md §3` historical-artifact 레지스트리에 등재된 기존 예외를 그대로 인정하고 있으며, 번복이나 새 규약 위반이 아니다.

## 요약

payload는 baseline spec(`1-auth.md` 전문, `10-graph-rag.md` 전문, 다수 무관 spec의 Rationale 발췌)만 담고 있어 "invite-accept-confirm-ui" 작업이 실제로 무엇을 바꾸려는지(diff)가 드러나지 않는다. 포함된 `1-auth.md §1.5` 초대 흐름 자체는 자신의 Rationale(1.5.A~D)과 완전히 정합하며, 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 다만 초대 수락 화면과 인접한 `9-user-profile.md`의 위험도별 편집 마찰 원칙 및 §4.1.1 초대 UI 내용이 payload에서 누락되어, 신규 confirm UI가 그 원칙 및 Rationale 1.5.A의 "마찰 최소화" 의도와 정합하는지는 이번 검토 범위 밖으로 남는다. Critical/Warning 급 충돌은 발견되지 않았으나, 이는 실제 변경분이 payload에 부재한 데 기인할 수 있으므로 신규 변경 스펙을 포함한 재검토를 권고한다.

## 위험도

LOW
