draft 전체를 검토했습니다. 다음은 정식 규약 기준 분석 결과입니다.

---

## Convention Compliance Check — spec draft (--spec)

**대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`

---

### 발견사항

---

- **[WARNING]** ``:installToken`` vs ``:install_token`` — draft 내부 path parameter 표기 불일치
  - **target 위치**: DRAFT 2J-1 설명 텍스트 vs DRAFT 2J-2 식별 전략 단락
  - **위반 규약**: 프로젝트 내 URL path parameter 명명 공식 규약은 없으나, **같은 draft 내에서 두 표기가 혼용**됨
  - **상세**:
    - DRAFT 2J-1 URL: `` `GET /api/integrations/oauth/install/cafe24/:installToken` `` (camelCase)
    - DRAFT 2J-2 식별 전략: ``"App URL path 의 `:install_token` 으로 단일 row 조회"`` (snake_case)
    - DRAFT 2E URL 설명: ``"path 의 `:installToken` 은 oauth/begin 응답으로 받은"`` (camelCase)
    - DRAFT 2C 응답 예시: ``:installToken`` (camelCase)
  - **제안**: DRAFT 2J-2 식별 전략 단락의 `:install_token` 을 `:installToken` 으로 통일. URL path parameter는 camelCase(`:installToken`), DB 컬럼/텍스트 기술은 snake_case(`install_token`)로 일관 분리하고, 이 분리 원칙을 2J-2 단락에 한 문장으로 명시.

---

- **[WARNING]** `spec/conventions/cafe24-api-metadata.md` §6 수정이 spec draft 범위에 포함됨
  - **target 위치**: DRAFT 2H 마지막 항목 (I10 라벨)
  - **위반 규약**: CLAUDE.md Skill 체계 — "정식 규약(`spec/conventions/*.md`)은 별도 검토 맥락에서 관리"가 암시됨 (spec draft는 spec/* 본문 패치를 목적으로 함)
  - **상세**: 본 draft는 `spec/2-navigation/`, `spec/1-data-model.md`, `spec/data-flow/`, `spec/4-nodes/` 를 패치하는 것이 주목적이나, convention 파일인 `spec/conventions/cafe24-api-metadata.md §6` 도 함께 수정함. 내용 자체(UI "카테고리" vs 백엔드 "Resource" 용어 분리)는 적절하나, convention 파일 수정이 spec draft 내에 섞이면 검토 범위가 불명확해지고, 이후 다른 convention을 참조하는 문서들의 업데이트 여부 추적이 어려워짐.
  - **제안**: 두 가지 선택지 — (a) convention 파일 수정 항목을 "영향받는 연관 문서" 섹션에 명시하고 별도 convention 개정 PR로 분리; (b) 현 draft 내에 유지하되 "## 영향받는 연관 문서" 목록에 `spec/conventions/cafe24-api-metadata.md §6 (convention 파일 — 용어 명확화)` 라고 명시적 주석을 붙여 검토자가 인지하게 함. 내용이 기존 규약과 충돌하지 않는 additive 변경이므로 BLOCK 수준은 아님.

---

- **[INFO]** DRAFT 2J-2 TypeScript 예시에 코드 주석 추가
  - **target 위치**: DRAFT 2J-2, `verifyHmac` 함수 앞 diff 추가 줄
  - **위반 규약**: CLAUDE.md "Default to writing no comments. Only add one when the WHY is non-obvious"
  - **상세**: spec 문서 내 TypeScript 예시 코드이므로 프로덕션 코드 규칙과 동일하게 적용할지는 불명확하나, "WHY가 non-obvious한 경우"에 해당한다고 볼 수 있어 INFO 수준. 단, developer가 spec을 그대로 참고해 구현 시 프로덕션 코드에 불필요한 주석이 복사될 위험 있음.
  - **제안**: 주석 내용을 앞 단락 산문으로 흡수하거나, "⚠ 구현 시 이 주석은 제거" 표기 추가.

---

- **[INFO]** `install_token` 컬럼 migration V번호 참조(`V042`)가 규약 파일명 형식 없이 inline 기재
  - **target 위치**: DRAFT 3D `integration` 행 설명, DRAFT 1C `status_reason` 행 설명
  - **위반 규약**: `spec/conventions/migrations.md §1` — 마이그레이션은 `V<번호>__<snake_case_descriptor>.sql` 형식
  - **상세**: spec 본문에 "V042 추가" / "V042 이후 키 회전" 형식으로 migration 번호만 참조하고 descriptor가 없음. spec이 migration 파일명 전체를 기술할 필요는 없지만, V번호만 언급하면 독자가 어떤 migration인지 파악하기 어려움.
  - **제안**: `V042 (install_token 컬럼 추가)` 또는 실제 파일명 기재. migrations.md 규약은 파일명 형식에 관한 것이므로 spec 참조 표기까지 강제하진 않음 — 독자 편의 개선 제안.

---

### 요약

전체적으로 규약 준수 수준이 높다. 에러 코드(UPPER_SNAKE_CASE), status_reason 값(snake_case), 문서 구조(Rationale 섹션 신설), Cafe24 API 메타데이터 컨벤션(scopeType/카테고리 용어) 모두 정식 규약과 정합. Critical 위배는 없음. 유의할 사항은 두 가지 — DRAFT 2J-2의 `:install_token` 표기가 draft 전체에 걸쳐 `:installToken`으로 쓰인 것과 달라 적용 시 spec에 불일치 잔류, 그리고 convention 파일 수정이 spec draft 범위에 섞여 검토 범위가 흐려지는 점.

### 위험도

**LOW** — Critical 위배 없음. DRAFT 2J-2의 path parameter 표기 불일치(`:install_token` vs `:installToken`)만 apply 전에 수정하면 됨.