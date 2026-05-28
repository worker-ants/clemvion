# 신규 식별자 충돌 검토 — spec-draft-triggers-auth-column

검토 대상: `plan/in-progress/spec-draft-triggers-auth-column.md`  
적용 대상 spec: `spec/2-navigation/2-trigger-list.md`  
검토 모드: spec draft (--spec)

---

## 발견사항

### [CRITICAL] R-15 식별자가 `spec/6-brand.md` 에서 이미 다른 의미로 사용 중

- **target 신규 식별자**: `R-15. 외부 노출 webhook 무인증 경고 표시 (2026-05-29)` — `spec/2-navigation/2-trigger-list.md` Rationale 섹션에 삽입 예정
- **기존 사용처**: `spec/6-brand.md` 전체에 걸쳐 `R-15` 가 "워드마크 layout 개정 — capital C, monochrome, no sub-copy (2026-05-25)" 의미로 광범위하게 사용됨. 동 파일 내 참조 횟수 약 20회 이상 (예: `| R-15 신설.`, `*Superseded by R-15 (2026-05-25)*`, `### R-15. 워드마크 layout 개정 — capital C, monochrome, no sub-copy (2026-05-25)` 등)
- **상세**: `R-` 접두사 + 번호 형식의 Rationale ID 는 spec 파일마다 독립 namespace 로 운영된다. `6-brand.md` 의 `R-15` 와 `2-trigger-list.md` 의 `R-15` 는 서로 다른 파일에 있으므로 **기술적으로 충돌하지 않는다**. 그러나 orchestrator·리뷰어·검색 도구가 전체 spec 에 대해 `R-15` 를 검색할 때 두 파일의 결과가 동시에 반환되어 의미 혼선이 발생할 수 있다. 특히 brand spec 은 다른 spec 으로부터 cross-reference 된다(`spec/2-navigation/10-auth-flow.md` 에서 logo 참조 등). 또한 `spec/2-navigation/2-trigger-list.md` 의 기존 R-14 가 `(2026-05-28)` 날짜 기준이고, target 이 삽입하는 R-15 는 `(2026-05-29)` 로 연속 번호이므로 같은 파일 내 순서는 정합하지만, `6-brand.md` 의 R-14 (`"2-tone 폐기 시작 Rationale"`) + R-15 (`"워드마크 layout 개정"`) + R-16 (`"흑백 단일"`) 시리즈와 **동일한 숫자 범위가 겹친다**.
- **제안**: `2-trigger-list.md` 에 삽입하는 Rationale 번호를 현행 최고 번호인 R-14 의 다음인 R-15 대신 **R-15** 는 brand 에서 이미 사용 중임을 인식하고 필요 시 `2-trigger-list.md` 내부 일련번호를 그대로 R-15 로 유지 가능. 단, 전체 spec 대상 검색 편의를 위해 `R-TL-15` 또는 `TR-R-15` 같이 파일-scope prefix 를 붙이는 컨벤션 도입을 권장. 단기적으로는 R-15 를 `2-trigger-list.md` 에 삽입해도 기능적 충돌은 없으므로 **파일 내 독립 namespace 정책을 문서화**하는 보완으로 수용 가능.

---

### [WARNING] `useAuthConfigs` 훅 이름 — spec 에서 신규 참조하지만 해당 훅은 현재 `trigger-detail-drawer.tsx` 전용으로 존재

- **target 신규 식별자**: `useAuthConfigs` — spec 본문 `§2.1 인증 열` 설명에 "프론트가 워크스페이스 AuthConfig 목록(`useAuthConfigs`)으로 type 해석" 으로 명시
- **기존 사용처**: `codebase/frontend/src/components/triggers/auth-config-select.tsx:21` 에서 정의, `trigger-detail-drawer.tsx:392` 에서 import. 현재는 **drawer(상세 패널) 에서만** 사용되고 있으며, 목록 행(§2.1) 에서는 호출되지 않음.
- **상세**: target 은 트리거 목록 행에 "인증" 열을 추가하고 `useAuthConfigs` 로 AuthConfig type 을 해석한다고 spec 화한다. 그러나 현재 구현에서 이 훅은 drawer 전용이다. spec 이 목록 레벨에서 `useAuthConfigs` 를 참조함으로써, 구현 단계에서 해당 훅을 목록 레벨 컴포넌트로도 확장해야 한다는 의도를 담는다. 기존 사용처와 의미 충돌은 없으나, 훅 이름이 spec 에 하드코딩됨으로써 나중에 훅이 리팩토링될 경우 spec-impl 드리프트 위험이 생긴다.
- **제안**: spec 본문에서 훅 이름을 직접 명시하기보다 "워크스페이스 AuthConfig 목록 API (`GET /api/auth-configs`) 응답" 과 같이 API 계약 수준으로 표현하거나, `useAuthConfigs` 옆에 `(hook: auth-config-select.tsx)` 처럼 구현 위치를 명시하는 것이 spec-impl 연계를 명확하게 유지함.

---

### [WARNING] `§2.1` 에 삽입되는 "인증" 열 — 기존 `§2.3` 의 "인증 설정" 섹션과 레이블 중복

- **target 신규 식별자**: `| 인증 |` — §2.1 목록 항목 표에 신규 행으로 삽입
- **기존 사용처**: `spec/2-navigation/2-trigger-list.md:71` — `§2.3 트리거 상세 패널` 표의 `| 인증 설정 |` 행 ("연결된 AuthConfig 정보")
- **상세**: `§2.1` 목록 레벨 열 이름이 `인증` 이고, `§2.3` 상세 패널 섹션 이름이 `인증 설정` 이다. 완전 동일하지는 않으나, 한국어 문서에서 reader 가 "인증" 과 "인증 설정" 을 혼동할 수 있다. 특히 연결 문서(`_product-overview.md` NAV-TR-10) 가 `authType / hmacHeader / hmacSecret / bearerToken` 같은 인라인 인증 필드 기준으로 기술되어 있어, 신규 "인증" 열이 AuthConfig binding 을 가리킨다는 점이 명확하지 않을 수 있다.
- **제안**: §2.1 신규 행의 이름을 `| 인증 |` 대신 `| 인증 설정 (AuthConfig) |` 또는 `| 인증 |` 그대로 쓰되 설명란에 "(AuthConfig 연결 여부)" 를 명시해 §2.3 의 "인증 설정" 카드와 연결 관계를 드러냄.

---

### [INFO] `R-14` 교차 참조 문구가 target draft 에 포함 — R-14 자체는 이미 정의됨

- **target 신규 식별자**: R-15 본문 내 `AuthConfig binding 정책 자체는 [§2.3.1 Auth Config 행](#231-필드-권한-매트릭스) + [R-14](#r-14-authconfigid-v1-격상--inline-인증-필드-제거-2026-05-28) 가 SoT.` 라는 교차 참조 문구
- **기존 사용처**: `spec/2-navigation/2-trigger-list.md:308` — `### R-14. authConfigId v1 격상 — inline 인증 필드 제거 (2026-05-28)` 이미 정의됨.
- **상세**: 충돌 없음. R-14 앵커는 이미 존재하고 target 의 교차 참조는 정합하다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/2-navigation/_product-overview.md` NAV-TR-10 기술이 인라인 인증 필드 기준으로 남아 있어 신규 AuthConfig 모델과 불일치

- **target 신규 식별자**: "인증" 열은 §2.1 에만 삽입. target draft 는 `_product-overview.md` 변경을 포함하지 않음.
- **기존 사용처**: `spec/2-navigation/_product-overview.md:65` — `NAV-TR-10 | 트리거 상세 드로어에서 이름·웹훅 인증(authType / hmacHeader / hmacSecret / bearerToken / endpointPath) 을 GUI 로 수정 가능.` — 이미 R-14 로 폐기된 인라인 인증 필드 이름이 요구사항 본문에 그대로 남아 있다.
- **상세**: target draft 자체가 도입하는 새 식별자와의 직접 충돌은 아니지만, target 이 `authConfigId` binding 모델을 spec 에 반영할 때 `_product-overview.md` 의 NAV-TR-10 도 함께 갱신되지 않으면 spec-internal drift 가 발생한다. 이는 naming collision 범주보다는 일관성 갭이지만, 새 "인증" 요소가 삽입될 때 독자가 NAV-TR-10 을 참조하면 혼선이 생기므로 기록한다.
- **제안**: target spec draft 를 `2-trigger-list.md` 에 적용할 때, 같은 PR 에서 `_product-overview.md` NAV-TR-10 의 `authType / hmacHeader / hmacSecret / bearerToken` → `authConfigId (AuthConfig binding)` 으로 갱신하는 것을 권장.

---

## 요약

target draft 가 도입하는 핵심 신규 식별자는 **Rationale ID `R-15`** 와 목록 열 이름 **`인증`**, 그리고 hook 참조 **`useAuthConfigs`** 세 가지다. 이 중 `R-15` 는 `spec/6-brand.md` 에서 "워드마크 layout 개정 (2026-05-25)" 의미로 이미 광범위하게 사용 중이어서, 전체 spec 검색 시 의미 혼선이 발생할 수 있는 잠재적 충돌이 존재한다. 단, Rationale ID 는 파일 내 독립 namespace 로 운영되므로 기능적 충돌은 아니다. `인증` 열 이름은 §2.3 의 `인증 설정` 과 유사해 혼동 가능성이 있고, `useAuthConfigs` 훅 참조는 현재 구현 위치와 spec 의도 간 범위 불일치를 초래할 수 있다. API endpoint, 이벤트/메시지명, 환경변수, 파일 경로 충돌은 발견되지 않았다.

## 위험도

MEDIUM
