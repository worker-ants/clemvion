# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/, diff-base=HEAD~12)
검토 대상: spec/ 전체 (HEAD~12 이후 변경된 문서 중심, 관련 convention 참조)

---

## 발견사항

### [WARNING] V085·V087 마이그레이션에 `-- DOWN:` 주석 누락

- **target 위치**: `/Volumes/project/private/clemvion/codebase/backend/migrations/V085__execution_user_variables.sql`, `V087__execution_resume_call_stack.sql`
- **위반 규약**: `spec/0-overview.md §2.8` — "운영 사고 대비 롤백 SQL 은 각 마이그레이션 파일 하단에 `-- DOWN:` 주석으로 보존한다". `codebase/backend/migrations/README.md §2` 에서도 동일 요건을 코드 수준에서 명시.
- **상세**: V085(ADD COLUMN `user_variables JSONB NULL`)·V087(ADD COLUMN `resume_call_stack JSONB NULL`)은 단순 컬럼 추가로 `DROP COLUMN` 으로 역전 가능하나 `-- DOWN:` 주석이 없다. 같은 시기의 V086·V088–V094는 모두 `-- DOWN:` 을 보유하여 V085·V087만 누락된 상태다. 이전 시대의 마이그레이션(V081, V082, V084 등 다수)도 같은 누락 패턴을 보이지만 본 리뷰 범위(HEAD~12 포함 이전 커밋 연속)에서도 컨벤션 위반이 수정되지 않은 채 잔존한다.
- **제안**: 두 파일 하단에 각각 `-- DOWN:` 블록을 추가한다. V085: `-- DOWN: ALTER TABLE execution DROP COLUMN IF EXISTS user_variables;`. V087: `-- DOWN: ALTER TABLE execution DROP COLUMN IF EXISTS resume_call_stack;`. 컨벤션 자체를 완화할 의도가 없다면 이전 시대 누락 마이그레이션(V081, V082, V084 등)도 동일하게 보강하거나, conventions/migrations.md 에 "기존 누락은 허용된 이력" 을 명시해 향후 신규 파일 의무만 강제할 수 있다.

---

### [WARNING] `spec/conventions/swagger.md` — `## 0)` 섹션 번호가 기존 컨벤션과 불일치

- **target 위치**: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` 23행 — `## 0) Swagger UI 노출 정책 ...`
- **위반 규약**: `spec/conventions/swagger.md` 자체의 기존 섹션 체계 및 cross-reference 패턴. 기존 본문·Rationale 에서 `swagger.md §2-4` 형태로 참조되는 패턴은 1-based 정수 section 번호를 전제한다. `error-codes.md §18` 도 `swagger.md §2-4` 를 참조한다.
- **상세**: 신규 §0 은 "기존 §1~§6 앞에 준비 섹션을 넣는" 의도로 보이나, 섹션 번호 0은 Markdown 앵커(`#0-swagger-ui-노출-정책`)를 생성하고 기존 `##-1-dto-패턴` 등의 번호 체계와 혼재된다. Rationale 내부도 `### §0 ...` 형태로 교차 참조하여 스스로 비표준 번호를 쓴다. 다른 convention 문서(`migrations.md`, `error-codes.md`)는 모두 1-based 섹션이다.
- **제안**: (a) 섹션 번호를 1-based로 유지하고 신규 내용을 `## 1) Swagger UI 노출 정책` 으로 배치하고 기존 섹션을 `## 2) DTO 패턴` 등으로 renumber 한다 (cross-reference 업데이트 필요). 또는 (b) 현재 `## 0)` 을 유지하고, `error-codes.md §18`·`spec/5-system/3-error-handling.md` 등에서 `swagger.md §2-4` 로 참조하던 링크를 `§3-4`로 갱신한다. 규약 갱신 의도라면 `spec/conventions/` 전체 섹션 번호 체계에 `0-` prefix 허용 여부를 migrations.md 에 명시하는 것도 방법이다.

---

### [INFO] `spec/1-data-model.md §2.16` 에 `#### Rationale` 인라인 중첩 — 본문 내 결정 근거 이중 위치

- **target 위치**: `/Volumes/project/private/clemvion/spec/1-data-model.md` 557행 — `#### Rationale (ModelConfig 통합)`
- **위반 규약**: `CLAUDE.md` — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". 동일 파일 826행에 `## Rationale` 가 따로 있다.
- **상세**: `§2.16 ModelConfig` 내부에 `#### Rationale (ModelConfig 통합)` 가 인라인으로 존재하고, 이 내용이 문서 끝 `## Rationale` 에 별도 항목으로 중복되지 않는다(한 곳에만 있음). 즉 Rationale 내용이 두 위치로 분산된 구조다. 동 파일 `§2.17.3 Rationale (AuthConfig 도메인)` 도 같은 패턴이나, `## Rationale` 본체에는 별개 결정들이 있어 일관성이 불완전하다.
- **제안**: 인라인 `#### Rationale` 를 제거하고 내용을 문서 끝 `## Rationale` 로 이전해 단일 위치를 유지하거나, 현 패턴을 허용하되 "인라인 서브 섹션 Rationale + 문서 끝 Rationale 병행 허용" 을 CLAUDE.md 에 명시한다. 기능·정확성 문제가 아닌 구조 일관성 이슈이므로 INFO 등급.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` — entity_id 명명 변경이 `spec-impl-evidence.md` 제외 규칙과 정합하는지 명시 부재

- **target 위치**: `/Volumes/project/private/clemvion/spec/conventions/cafe24-api-catalog/_overview.md` §7.1 — entity_id 를 `snake_case` → `kebab-case` 로 정정
- **위반 규약**: 직접 위반 아님. 다만 `spec/conventions/spec-impl-evidence.md §1` 의 제외 패턴은 `<name>-api-catalog/<resource>/**/*.md` 이며, 이 패턴은 파일 명명 스타일(kebab vs snake)과 무관하다. 단, `spec-impl-evidence.md` 의 제외 항목 설명 문구에 "snake_case" 가 있었다면 불일치가 발생한다.
- **상세**: `spec-impl-evidence.md §1` 을 확인하면 "API 레퍼런스 카탈로그의 **필드 단위 파일**" 이라는 설명만 있고 파일 명명 스타일은 명시하지 않는다. 실제 파일도 이미 kebab-case(`appstore-orders.md`)이므로 코드 수준 불일치는 없다. _overview.md 에서 "snake_case → kebab-case" 를 명시한 것은 기존 오기록을 정정한 것이며 정합하다.
- **제안**: 개선 불필요. 다만 Rationale 에 "기존 문서에 snake_case 로 잘못 기재됐고 실제 파일은 항상 kebab-case였다" 는 사실을 한 줄 추가하면 미래 독자의 혼란을 방지할 수 있다.

---

### [INFO] `spec/5-system/1-auth.md` Rationale 서브섹션 번호 패턴 `### 2.3.B` — 숫자-알파 혼합 anchor

- **target 위치**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` — `### 2.3.A`, `### 2.3.B`, `### 2.3.C`
- **위반 규약**: 명시적 금지 규약 없음. 다만 `## Rationale` 서브섹션 이름에 `2.3.B` 같이 본문 섹션 번호를 anchor 에 쓰는 관행은 다른 파일에서는 `### 제목명 (context)` 형태이고, `spec/0-overview.md §Rationale` 도 `### S3 객체 키 prefix 설계` 형태로 본문 섹션 번호를 쓰지 않는다.
- **상세**: `1-auth.md §Rationale 2.3.A/B/C` 패턴은 `2.3` 이라는 본문 섹션 번호를 Rationale 서브 항목 이름에 포함시킨다. 본문의 `§2.3 세션 정책` 이 `§2.4`, `§2.5` 로 번호가 바뀌면 Rationale anchor 가 stale 해질 위험이 있다. 이 위험은 낮지만 관행 불일치를 만든다.
- **제안**: `### 2.3.B — ...` 대신 `### Refresh 쿠키 SameSite·CSRF 와 클라이언트 IP 신뢰 (M-5·m-3)` 처럼 의미 중심 제목을 쓰는 것이 다른 Rationale 서브섹션과 일관된다. 변경은 선택적이며 현 기능에 지장 없음.

---

## 요약

이번 리뷰 범위(HEAD~12, `spec/` 및 연관 마이그레이션)의 정식 규약 준수 수준은 전반적으로 양호하다. 명명 규약(마이그레이션 V번호 단조성·snake_case 설명자·연속성)은 V085–V094 전체가 준수한다. 출력 포맷·에러 코드·Swagger DTO 패턴·spec-impl-evidence frontmatter 는 변경된 파일 모두 규약을 따른다. 가장 주목할 발견은 두 가지다: (1) V085·V087 마이그레이션의 `-- DOWN:` 주석 누락(spec/0-overview.md §2.8·migrations/README.md §2 위반, WARNING), (2) `swagger.md` 에 신설된 `## 0)` 섹션 번호가 기존 1-based 섹션 체계 및 외부 cross-reference 와 충돌할 수 있는 점(WARNING). 나머지는 구조 일관성 수준의 INFO 사항이다.

## 위험도

LOW
