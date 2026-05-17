# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-notification-dismiss.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-17

---

### 발견사항

- **[INFO]** plan 문서 frontmatter 규약 준수 — 양호
  - target 위치: 파일 상단 frontmatter
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클
  - 상세: `worktree`, `started`, `owner` 3개 필드 모두 정확히 기입. `worktree: notification-actions-8806b6` 로 현재 worktree 와 일치. 위반 없음.
  - 제안: 해당 없음.

- **[INFO]** API 응답 래퍼 패턴 — `{ data: { affected: number } }` 명시
  - target 위치: 변경안 #1 §4.2 Endpoint "일괄 dismiss" 응답 설명
  - 위반 규약: `spec/conventions/swagger.md` §2-5, §5-2
  - 상세: 일괄 dismiss 응답을 `{ data: { affected: number } }` 래퍼 규약 형태로 명시. Swagger 규약의 `TransformInterceptor` 래핑(`{ data: ... }`) 과 일치한다. 단, spec 문서(서술 레벨)에서 래퍼 형태를 명시한 것은 적절하며 위반 아님. 단건 dismiss는 `204 No Content`(body 없음)로 래퍼 불필요 — 이 역시 Swagger 규약 §2-4 와 일치.
  - 제안: 해당 없음.

- **[WARNING]** 상태 전이 다이어그램의 endpoint 표기 일관성 — `PATCH` vs `POST`
  - target 위치: 변경안 #1 §1-C "§3 상태 전이 mermaid 다이어그램 갱신" 신규 다이어그램
  - 위반 규약: `spec/conventions/swagger.md` §2-4 (상태 코드·HTTP 메서드 규칙), CLAUDE.md 정보 단일 진실 원칙
  - 상세: 기존 다이어그램의 `PATCH /notifications/read-all` 을 `POST /notifications/mark-all-read` 로 정정한다고 명시하면서, 신규 다이어그램에도 올바르게 `POST /notifications/mark-all-read` 로 반영했다. 그러나 바로 아래 주석에서 "옛 표기의 `PATCH /notifications/read-all` 은 실제 구현 `POST /notifications/mark-all-read` 로 정정" 이라고 설명하고 있어, spec 이 오류를 바로잡는 의도임을 인식하고 있다. 규약 위반은 아니지만, spec 문서가 과거 오류를 "정정"하는 경위를 서술하는 방식이 spec 문서보다 이력 문서에 가깝다. spec 의 본문은 "latest 상태"를 기술해야 하므로 (CLAUDE.md 프로젝트 스펙 문서 절) 해설 주석을 최소화하는 것이 바람직하다.
  - 제안: 신규 다이어그램 아래의 `>` blockquote 주석에서 "옛 표기" 경위 설명을 Rationale 섹션으로 이동하거나 생략한다. spec 본문은 현재 올바른 endpoint 만 서술하면 충분하다.

- **[WARNING]** 마이그레이션 번호 자리 표기 — `V0NN` 패턴
  - target 위치: 변경안 #1 §1-B "§2.1 Postgres 표 갱신" 및 §Rationale 마이그레이션 번호 설명
  - 위반 규약: `spec/conventions/migrations.md` §1 (명명 규약), §2 (V번호 정책)
  - 상세: draft 에서 `V0NN` 이라는 placeholder 표기를 사용해 "developer 단계에서 실제 번호로 채운다" 고 설명한다. `spec/conventions/migrations.md` §1은 `V<번호>__<snake_case_descriptor>.sql` 형식만 허용하고, §2는 "신규 V번호는 항상 현재 main 의 max(V) +1" 임을 규정한다. 또한 §1에서 `alphanumeric suffix 금지`를 명시한다. spec draft 내의 `V0NN` 은 실제 파일명이 아니라 placeholder 이므로 직접 위반은 아니지만, spec 문서에 placeholder 번호가 남아 있으면 개발자 혼란을 초래할 수 있다. 마이그레이션 번호는 spec 이 확정해야 하는 값이 아닌, developer 단계에서 결정되는 값이므로 placeholder 표기 자체는 이해 가능하다.
  - 제안: `V0NN` 표기 대신 "마이그레이션 번호는 developer 단계에서 `spec/conventions/migrations.md §5` 절차에 따라 결정" 이라는 참조 형식으로 교체하면 spec 문서 관점에서 더 명확하다. placeholder 를 그대로 두더라도 critical 위반은 아니다.

- **[INFO]** 문서 구조 규약 — spec draft 의 섹션 구성
  - target 위치: 파일 전체 구조
  - 위반 규약: CLAUDE.md 프로젝트 스펙 문서 §권장 3섹션 구성 (Overview / 본문 / Rationale)
  - 상세: 본 파일은 `plan/in-progress/` 에 위치한 **plan 문서**이지 `spec/` 의 직접 spec 문서가 아니다. plan 문서에는 3섹션 권장이 적용되지 않으며, 실제로 변경안 #1에 Rationale 추가안이 포함되어 있어 각 spec 파일에 Rationale 이 반영될 예정임을 보여준다. 본 draft 문서 자체의 구조는 plan 문서로서 적절하다.
  - 제안: 해당 없음.

- **[INFO]** 금지 경로 사용 여부 — `prd/`, `memory/`, `user_memo/` 등
  - target 위치: 파일 전체
  - 위반 규약: CLAUDE.md 명명 컨벤션 "옛 경로 사용 금지"
  - 상세: 금지된 옛 경로(`prd/`, `memory/`, `user_memo/`) 에 대한 언급이나 참조가 없다. 수정 대상 spec 경로도 모두 `spec/` 하위를 올바르게 참조한다.
  - 제안: 해당 없음.

- **[INFO]** API endpoint 명명 규약 — dismiss 에 `DELETE` 사용
  - target 위치: 변경안 #1 §4.2 Endpoint 표, §1-C 상태 전이 다이어그램
  - 위반 규약: 해당 정식 규약 명시 없음 (REST 일반 관례 수준)
  - 상세: soft delete(dismiss)에 `DELETE` 메서드를 사용한다. 실제로는 데이터를 삭제하지 않고 `dismissed_at` 을 set 하는 동작이므로 `PATCH` 또는 `POST` 가 더 명확한 선택이라는 REST 관점 견해가 있을 수 있다. 그러나 `spec/conventions/` 에 이를 금지하는 규약이 없고, HTTP 의미론상 "리소스를 더 이상 활성 목록에서 제거한다" 는 의미로 `DELETE` 를 사용하는 것은 허용 범위 내다. Rationale §4.5(보존 정책)에서 soft delete 선택 이유를 충분히 설명하고 있어 의도가 명확하다.
  - 제안: spec/conventions 에 REST endpoint 메서드 선택 가이드라인이 없으므로 INFO 수준 메모로만 기록. 규약이 필요하다고 판단되면 별도 conventions 문서 추가를 검토.

- **[INFO]** 노드 Output 규약 관련성 없음
  - target 위치: 파일 전체
  - 위반 규약: `spec/conventions/node-output.md`
  - 상세: 본 draft 는 알림 dismiss API 의 데이터 모델·endpoint·상태 전이 spec 으로, 워크플로우 노드 Output 규약(`node-output.md`)의 적용 범위(핸들러 반환 형태)와 직접적인 관련이 없다. 위반 없음.
  - 제안: 해당 없음.

- **[INFO]** Cafe24 API Catalog 규약 관련성 없음
  - target 위치: 파일 전체
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md`
  - 상세: 본 draft 는 자체 서비스의 알림 기능 spec 이며 Cafe24 API catalog 와 무관하다. 위반 없음.
  - 제안: 해당 없음.

---

### 요약

`plan/in-progress/spec-draft-notification-dismiss.md` 는 정식 규약을 전반적으로 잘 준수하고 있다. frontmatter 3 필드 완비, 수정 대상 spec 경로의 올바른 `spec/` 하위 참조, 응답 래퍼 규약(`{ data: ... }`) 적용, 금지된 옛 경로 미사용 등이 모두 적절하다. 발견된 WARNING 2건은 각각 (1) spec 본문에 이력 설명 주석이 포함된 점(Rationale 로 이동 권장), (2) 마이그레이션 번호 placeholder `V0NN` 표기가 규약 참조 형식으로 교체되면 더 명확해진다는 점이며, 어느 쪽도 다른 시스템의 invariant 를 깨는 수준은 아니다. CRITICAL 위반은 없다.

### 위험도

LOW
