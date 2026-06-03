### 발견사항

- **[INFO]** `spec/5-system/16-system-status-api.md` R-2 (throughput 시계열 v1 제외) 와 target R-5 의 `recentFailed` 설계 — 논리적으로 모순 없음, 그러나 명시 보강 권장
  - target 위치: §A Rationale R-5 "R-2(throughput 시계열 v1 제외)와의 대조" 단락
  - 충돌 대상: `spec/5-system/16-system-status-api.md` §Rationale R-2
  - 상세: R-2 는 "throughput 추이는 별도 샘플링 cron·저장소가 필요"하여 v1 제외했다고 기술한다. target 의 `recentFailed` 는 "BullMQ 이미 보관 중인 failed 집합을 윈도우 필터링할 뿐 별도 저장소가 불필요"하다고 R-5 에서 스스로 대조한다. 이 대조 설명은 정확하고 모순이 없다. 그러나 R-2 본문 자체("throughput 추이는 …별도 저장·구성요소가 필요")는 갱신 없이 그대로 남아, 새 독자가 R-2 를 보고 `recentFailed` 도 같은 이유로 제외된 것으로 오해할 여지가 있다.
  - 제안: R-2 말미에 "단, 단일 윈도우 스냅샷(`recentFailed`)은 별도 저장소 없이 기존 failed 집합 필터링으로 구현 가능해 R-5 에서 도입했다" 한 줄을 추가하거나, target §A 에서 R-2 와의 명시적 앵커 링크를 추가.

- **[INFO]** `spec/5-system/_product-overview.md` NF-OB-06 설명이 구 `failed` 단독 지표를 기술
  - target 위치: §D INFO 동기화 — NF-OB-06 설명 동기화 권고
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/_product-overview.md` §5 관측성 NF-OB-06 행 ("큐 적체/실패/포화도를 집계 UI 로 노출")
  - 상세: target 이 §D 에서 이미 인지하고 INFO 수준 동기화 항목으로 명시했다. 직접 충돌은 아니나 NF-OB-06 설명이 "최근 윈도우 실패 + 누적 보관 병기" 로 변경된 UI 를 반영하지 못하면 독자에게 혼선을 준다. target 의 §D 명시와 구현 완료 후 NF-OB-06 갱신이 함께 처리되지 않으면 spec 이중 상태(NF-OB-06: 구 문장 / 15-system-status.md: 신 표기)가 지속된다.
  - 제안: §D 의 INFO 동기화 적용을 체크리스트에 포함시켜 apply 단계에서 누락되지 않도록 확인. 현재 §D 는 적용 체크리스트(§진행 체크리스트) 안에 없다 — 항목 추가 권장.

- **[INFO]** `spec/2-navigation/15-system-status.md` §2.2 `totalFailed` 배지 설명이 "주 배지 = `totalRecentFailed`" 전환 후에도 현행 문장을 참조
  - target 위치: §B §2.2 종합 상태 헤더
  - 충돌 대상: `spec/2-navigation/15-system-status.md` §2.2 현행 문장("totalFailed(전 큐 실패 합계) 배지. 0 초과 시 강조.")
  - 상세: target §B 는 교체 방향을 명확히 설명한다("totalRecentFailed 를 주 배지로, totalFailed 를 부 배지로 병기"). 충돌 자체는 target 이 인지하고 교체를 지시하므로 apply 단계에서 처리된다. 다만 target 안의 §B §2.2 설명 문장과 §1 ASCII 아트 교체 사이에 내부 일관성 확인이 필요하다: ASCII 아트에 `failedWindowMinutes` 를 고정 "60" 으로 표기했으나 §2.2 는 "응답값(`failedWindowMinutes`)을 라벨에 반영"하라고 동적 표기를 지시 — ASCII 아트는 예시임을 주석·캡션으로 명시하거나, "최근 N분 실패" 형식으로 수정하면 혼용이 없다. 현재 ASCII 의 "최근 60분" 은 기본값 예시이지만 구현자가 고정값으로 오해할 수 있다.
  - 제안: §1 ASCII 아트의 "60분" 을 "N분" 또는 "60분(env 기본값)" 으로 명기하거나, 그 아래 캡션에 동적 표기임을 주석 추가.

- **[INFO]** `spec/5-system/16-system-status-api.md` §2 DTO 구조 변경 시 기존 응답 래핑 규약(`{data: …}`) 과의 일관성 — 문제 없음, 명시만 보강
  - target 위치: §A §2 API — DTO 변경
  - 충돌 대상: `spec/5-system/16-system-status-api.md` §2 ("응답: `{ data: SystemStatusOverviewDto }` 전역 `TransformInterceptor` 의 `{data}` 래핑 준수") · `spec/5-system/2-api-convention.md` §3 응답 구조
  - 상세: target 의 신규 필드(`totalRecentFailed`, `failedWindowMinutes`, `recentFailed`)는 기존 DTO 클래스에 `@ApiProperty` 로 additive 추가이므로 `TransformInterceptor` 래핑 형태는 변경 없이 유지된다. 충돌 없음. 다만 target §A 구현 노트에서 "기존 클래스에 `@ApiProperty` 로 추가"라고 적시했으므로 새 클래스 분리나 응답 shape 교체가 없음을 확인했다.
  - 제안: 추가 조치 불필요. API 컨벤션과 충돌 없음 확인.

- **[INFO]** Swagger 규약 §5-1 `*-response.dto.ts` 패턴 — target 이 이를 준수하도록 명시했고 충돌 없음
  - target 위치: §A §2 "구현 노트(DTO 파일명): `system-status-response.dto.ts`"
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` §5-1 ("`*-response.dto.ts` 패턴")
  - 상세: target 이 명시적으로 swagger 규약 §5-1 을 인용하고 파일명을 `system-status-response.dto.ts` 로 지정했다. 기존 규약과 충돌 없음.
  - 제안: 추가 조치 불필요.

- **[INFO]** `spec/5-system/16-system-status-api.md` §3 health 파생 규칙 3번의 비교 대상 전환 — 운영 주의 노트 충분, 추가 충돌 없음
  - target 위치: §A §3 health 파생 규칙 변경 (규칙 3: `recentFailed >= FAILED_DEGRADED_THRESHOLD`)
  - 충돌 대상: `spec/5-system/16-system-status-api.md` §3 현행 문장("failed >= FAILED_DEGRADED_THRESHOLD") · `spec/5-system/1-auth.md` §3.1 RBAC 참고 노트("System Status: 모든 역할이 동일하게 읽기만 가능")
  - 상세: 규칙 3 의 비교 대상이 `counts.failed`(보관 중 누적)에서 `recentFailed`(최근 윈도우)로 바뀌는 것이 핵심 시맨틱 변경이다. target §A 는 "의미 변경 주의 노트"를 §3 env 설명에 추가하도록 명시했고 R-5 에서 근거도 충분히 제시한다. RBAC/권한 모델(`1-auth.md` 참고 노트)은 "모든 로그인 사용자 읽기 가능, admin 가드 없음"으로 변경 없음. 충돌 없음.
  - 제안: 추가 조치 불필요. 운영자 재검토 안내가 spec 에 명시됐으므로 충분.

- **[INFO]** `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 — `recentFailed` 스캔 비용 정보 미동기
  - target 위치: §A §2 구현/비용 노트 (스캔 비용 설명)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 — 큐별 `removeOnFail` 보관 정책 및 비용 설명 없음
  - 상세: target 이 `cafe24-token-refresh`(5분 보관)를 특수 케이스로 명시했다. `spec/data-flow/5-integration.md` 의 `cafe24-token-refresh` 항목에서 `removeOnFail: { age: 300 }` (5분)를 확인했다. target 이 "보관기간이 윈도우보다 짧은 큐(`cafe24-token-refresh` 5분)는 `recentFailed` 가 보관분으로 제한"라고 명시했는데, `execution-continuation` 큐의 `removeOnFail: false`(무한 보관)도 target 본문에 언급됐다. 이는 `spec/5-system/4-execution-engine.md` §9.3 과 일치한다. 충돌 없음. 단, 큐 카탈로그(`data-flow/0-overview.md`)에는 보관 정책이 요약되어 있지 않아 독자가 큐별 보관기간을 한곳에서 확인하기 어렵다. 직접 충돌은 아님.
  - 제안: 선택적. `data-flow/0-overview.md` §4 카탈로그에 `removeOnFail` 보관기간 컬럼을 추가하면 미래 `recentFailed` 유지보수 시 cross-reference 부담이 줄어든다.

---

### 요약

target 문서(spec-draft-system-status-recent-failed.md)가 제안하는 변경사항(`recentFailed`/`totalRecentFailed`/`failedWindowMinutes` DTO 추가, health 파생 규칙 3번의 비교 대상 전환, UI 병기 표기, NAV-SS-07/08 신규 요구사항 ID 추가)은 다른 영역 spec 과 직접 충돌하지 않는다. 신규 요구사항 ID NAV-SS-07·08 은 기존 NAV-SS-01~06 이후 연속 번호로 중복 없음, API DTO 추가는 하위호환(additive)이며 `TransformInterceptor` 래핑·Swagger §5-1·RBAC 모델과 모두 일관된다. 발견된 사항은 모두 INFO 등급으로, §D NF-OB-06 동기화가 실제 적용 체크리스트(§진행 체크리스트)에 누락된 점과 §1 ASCII 아트의 고정 "60분" 표기가 §2.2 의 동적 라벨 지시와 내부 혼용을 일으킬 수 있다는 두 가지 사소한 보강이 권장된다.

### 위험도
LOW

STATUS: OK
