# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/2-navigation/6-config.md`
검토 일시: 2026-06-14

---

## 발견사항

### [WARNING] §A.2 편집 폼 미구현 — plan 에 "결정 불필요" 항목으로 분리됐으나 spec 은 여전히 편집 폼을 선언함
- **target 위치**: `spec/2-navigation/6-config.md` §A.2 구현 현황 callout 마지막 문장 — "(생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공.)"
- **관련 plan**: `plan/in-progress/spec-sync-config-gaps.md` §미구현 — 결정 필요 / 후속 (본 PR 범위 밖), 마지막 항목 "§A.2 **편집 폼** IP Whitelist / api_key Header 이름 입력 — 현재 생성 폼만 지원 (편집 폼 자체가 없음, UI 는 생성·토글·재생성·삭제만). 편집 흐름 신설은 별도 범위."
- **상세**: spec §A.2 의 type-별 필드 표(API Key / Bearer Token / Basic Auth / HMAC)는 편집 UI 전제 형식으로 작성돼 있다(이름·헤더·IP Whitelist 등이 수정 가능한 필드로 나열). spec callout 이 "생성 후 편집 폼은 별도" 라고 단서를 달았지만, spec 본문 자체에서 편집 폼의 구체적인 필드 정의 범위는 명확히 구분되지 않는다. plan 은 이를 "별도 범위"로 명시적으로 분리했고 현 구현 착수(impl-prep) 대상에 포함되지 않는다. 구현자가 spec 필드 표를 보고 편집 폼도 동시에 구현해야 한다고 오해할 여지가 있다.
- **제안**: target spec 의 §A.2 구현 현황 callout 에 "편집 폼은 `spec-sync-config-gaps.md §A.2 편집 폼` 후속으로 분리됨" 이라는 명시적 링크·분리 근거를 추가하거나, plan 의 "별도 범위" 항목이 현 착수 대상에서 제외됨을 impl-prep 착수 범위 노트에 한 줄 추가한다. (spec 쪽 갱신이 더 효과적.)

---

### [INFO] §A.3 소스 IP·응답 코드·기간별 호출 수 — 결정 보류 항목이 spec 에 "Planned" 표기로 존재
- **target 위치**: `spec/2-navigation/6-config.md` §A.3 인증 사용량/이력 표 — 기간별 호출 수(🚧 미구현 Planned), 소스 IP·응답 코드 컬럼(미구현 / Planned)
- **관련 plan**: `plan/in-progress/spec-sync-config-gaps.md` §미구현 — 결정 필요 / 후속, 3개 항목 모두 "**결정 필요**" 표기
- **상세**: spec 은 이 항목들을 단순히 "Planned" 로 표기하고 있으나, plan 은 스키마·표시형식·의미(HTTP code vs status enum) 결정이 선행돼야 한다고 명시한다. 현재 impl-prep 범위(§A.2 IP Whitelist + Header 이름)에는 §A.3 항목이 포함되지 않으므로 직접 충돌은 없다. 단, spec "Planned" 표기가 이미 설계 결정이 완료된 것처럼 읽혀 다음 구현자가 결정 없이 착수할 위험이 있다.
- **제안**: plan 의 각 §A.3 항목에 "spec 의 'Planned' 표기는 설계 미결 상태이며 결정 선행 필요" 라는 주석이 이미 있으므로 추가 조치는 최소 수준. 다음 구현자를 위해 spec §A.3 의 "Planned" 표기에 `(결정 선행 필요 — spec-sync-config-gaps.md §A.3)` 같은 인라인 단서를 추가하면 INFO 수준의 혼선을 예방할 수 있다.

---

### [INFO] auth-config-webhook-followups §3 spec 보완 항목 — 6-config.md 와 간접 연관
- **target 위치**: `spec/2-navigation/6-config.md` §A.4 Reveal 흐름, §3 Authentication API 표
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §3 "spec 보완 (project-planner 영역)" — `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행 추가; IP whitelist CIDR/IPv6 지원 여부 명시
- **상세**: `6-config.md §3 Authentication API` 표에는 `POST /api/auth-configs/:id/reveal` 이 이미 열거돼 있다(§A.4 참조). auth-config-webhook-followups §3 의 요청은 `5-system/1-auth.md §5` 에도 동일 엔드포인트를 추가하는 것으로, `6-config.md` 와는 중복 선언이 아니라 cross-reference 목적의 별도 추가다. IP whitelist CIDR/IPv6 지원 여부는 `spec-sync-config-gaps.md` 와 중복 추적되지 않아 연계가 다소 불명확하다. 현재 착수 범위(§A.2 구현)에는 직접 충돌이 없다.
- **제안**: 추적 메모로 충분. 필요 시 `spec-sync-config-gaps.md` 에 IP whitelist CIDR/IPv6 지원 여부 결정 항목을 auth-config-webhook-followups §3 cross-reference 와 함께 등재해 단일 추적 위치를 확보한다.

---

## 요약

`spec/2-navigation/6-config.md` 의 현 내용은 활성화된 plan(`spec-sync-config-gaps.md`)이 명시한 결정 보류 항목(§A.3 소스 IP·응답 코드·기간별 호출 수, §A.2 편집 폼)을 일방적으로 결정하거나 우회하지 않는다. 또한 선행 plan 이 미해소인 채로 target 이 진행을 전제하는 구조도 없다. 주요 관찰사항은 spec §A.2 필드 표가 편집 폼과 생성 폼을 명시적으로 구분하지 않아 다음 착수자가 편집 폼도 현 scope 에 포함되는 것으로 오인할 여지가 있다는 점이다. 이 부분에 plan 의 "별도 범위" 결정을 spec 에 명시적으로 반영하면 WARNING 수준의 혼선이 해소된다.

## 위험도

LOW
