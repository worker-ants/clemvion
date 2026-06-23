# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 코드 변경: `interaction-config.dto.ts`, `web-chat-appearance.dto.ts`, `query-trigger.dto.ts`, `triggers.service.ts`

---

## 발견사항

- **[WARNING]** `WebChatAppearanceDto.suggestions` 단일 string vs BootConfig `string[]` — Rationale 미기재 설계 변환
  - target 위치: `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` (`suggestions?: string` MaxLength 1000) + `spec/7-channel-web-chat/5-admin-console.md §4`
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §4 BootConfig` — `welcome?: { text?: string; suggestions?: string[] }`, `launcher?: { suggestions?: string[] }` 로 `string[]` 타입 정의.
  - 상세: `BootConfig`(2-sdk §4)는 `welcome.suggestions`와 `launcher.suggestions`를 각각 `string[]`로 정의했다. 그런데 `WebChatAppearanceDto`(서버 저장 DTO)는 이를 줄바꿈 구분 단일 `string`으로 병합·저장한다. 클라이언트가 이 string을 어떻게 split해 `string[]`로 변환하는지, `welcome.suggestions`와 `launcher.suggestions`를 구분하는 경로가 어디인지가 Rationale에 기록되어 있지 않다. 5-admin-console.md §4는 "저장된 값은 인스턴스 로드 시 폼·미리보기·설치 스니펫에 시드된다"고 하지만, DTO 필드와 BootConfig 스키마 사이의 구조 변환 결정(단일 string 병합 채택, `string[]` 저장 기각)에 대한 근거가 없다. 5-admin-console.md R2는 "서버 저장"을 정당화하지만 저장 포맷 변환 선택은 다루지 않는다.
  - 제안: `5-admin-console.md §4` 또는 `R3`에 "suggestions 필드 포맷 — BootConfig의 `string[]`를 textarea 단일 문자열로 병합 저장, 클라이언트가 분리·매핑하는 이유"를 Rationale로 추가하거나, 또는 DTO를 `welcomeSuggestions?: string`과 `launcherSuggestions?: string`으로 분리해 BootConfig 구조를 추적 가능하게 한다.

- **[INFO]** `interactionEnabled` JSONB 필터 — Rationale 부재이지만 기각된 대안 없음
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `(t.config->'interaction'->>'enabled')::boolean = :interactionEnabled` JSONB 쿼리, `spec/7-channel-web-chat/5-admin-console.md §2`
  - 과거 결정 출처: `spec/0-architecture.md R5` — "백엔드 변경은 CORS·남용 방어로 억제", `spec/7-channel-web-chat/5-admin-console.md R1` — "트리거 재사용, backend 변경 최소화(env + 선택적 목록 필터)"
  - 상세: R1은 "선택적 목록 필터"를 허용 범위로 명시하고, 본 변경은 기존 `GET /api/triggers` endpoint에 쿼리 필터만 추가했다. 신규 endpoint·엔티티·facade가 없으므로 R1 원칙에 부합한다. 그러나 JSONB 경로 쿼리를 채택하고 인덱스를 두지 않은 결정(대안: `interaction_enabled` 컬럼화 + 인덱스)의 tradeoff가 Rationale에 없다. 현재는 INFO 수준이나 trigger 수가 증가하면 full-scan 문제가 될 수 있다.
  - 제안: `5-admin-console.md §2` 또는 R1에 "JSONB 경로 필터 채택 — 신규 컬럼 마이그레이션 없이 기존 config 구조 재사용, 현 규모에서 full-scan 허용, 성능 문제 발생 시 generated column + 인덱스 후속 검토" 한 줄을 추가한다.

- **[INFO]** `5-admin-console.md R2` 번복 기록 — 형식 완비, 추가 제안 없음
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md R2` + `_product-overview.md §2 비목표 carve-out`
  - 과거 결정 출처: 초기 v1 "외형 emit-only, 백엔드 미저장" 결정
  - 상세: 번복의 경위·범위·기존 결정과의 관계·보안 흡수 방안이 R2에 모두 기록되어 있고, `_product-overview.md §2`도 carve-out을 명시한다. 기각된 "별도 외형 관리 시스템 생성" 대안은 여전히 비목표로 유지된다. Rationale 연속성 관점에서 적절히 처리된 번복이다.

---

## 요약

`spec/7-channel-web-chat/` 전반은 기존 Rationale과 높은 연속성을 보인다. 가장 중요한 번복(외형 서버 저장)은 `5-admin-console.md R2`에 전말과 범위가 명기되어 있고, 기각된 "신규 엔티티 생성" 대안은 그대로 유지된다. 코드 변경(`WebChatAppearanceDto`, `interactionEnabled` 필터)도 `0-architecture R5`(client consumer 원칙)와 `5-admin-console R1`(trigger 재사용)을 준수한다. 다만 `WebChatAppearanceDto.suggestions`를 단일 문자열로 병합 저장하는 결정은 `2-sdk §4 BootConfig`의 `string[]` 구조와 불일치하며 이 변환 선택의 근거가 Rationale에 없어 WARNING으로 기록했다. 이 변환 결정이 명시되지 않으면 향후 스니펫 생성·미리보기 배선 시 혼란 가능성이 있다.

---

## 위험도

MEDIUM
