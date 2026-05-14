swagger.md까지 확인 완료. 이제 전체 분석을 정리합니다.

---

## Convention Compliance Check 결과

**검토 대상**: `plan/in-progress/spec-draft-cafe24-3rdparty-url.md`
**검토 모드**: spec draft (--spec)

---

### 발견사항

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` — 인라인 개정 이력 blockquote 누적이 "latest state" 원칙과 충돌
  - target 위치: `§ 3. spec/4-nodes/4-integration/4-cafe24.md > Line 389 — 개정 노트`
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — *"history 가 아닌 latest 에 대한 기술이므로, 변경이 누적되어 정합성이 흐려질 경우 문서를 전체적으로 정리·재구성한다."*
  - 상세: 기존 `2026-05-14 개정:` blockquote 를 보존한 채 `2026-05-15 개정:` blockquote 를 추가하는 방식은 spec 본문 안에 날짜 기반 이력이 쌓이는 패턴이다. CLAUDE.md 는 spec 본문이 최신 상태만 서술하도록 규정하며, 결정 배경·이력은 **`## Rationale` 섹션**에 두도록 한다.
  - 제안: `4-cafe24.md` 본문의 개정 blockquote 두 개를 제거하고, 해당 파일의 `## Rationale` 섹션에 두 변경(2026-05-14·15) 배경을 통합해 서술한다. 본문 step 본체는 최신 경로(`/api/3rd-party/cafe24/install/:installToken`, 16byte base64url 22자)만 기재한다.

- **[INFO]** `spec/1-data-model.md` — Rationale 갱신 내용 미기재
  - target 위치: `§ 1. spec/1-data-model.md > ※ 마이그레이션 신규 entry 추가 안 함` 노트
  - 위반 규약: CLAUDE.md §스펙 문서 권장 3섹션 — Rationale 섹션에 결정 배경·근거를 기술
  - 상세: draft 에서 `spec/2-navigation/4-integration.md` 의 Rationale 는 전문(全文)이 제공되어 있으나, `spec/1-data-model.md` 의 Rationale 갱신은 "Rationale 에 명시"로만 표기됐다. 추가될 내용이 명시되지 않아 spec write 단계에서 누락 위험이 있다.
  - 제안: spec draft 에 `spec/1-data-model.md` Rationale 추가 텍스트를 포함한다 (최소 1줄: "install_token 형식을 32byte hex → 16byte base64url 로 변경한 이유 + DB schema 무변경 이유"). 이미 `spec/2-navigation/4-integration.md` Rationale 에 상세 설명이 있다면 cross-link 처리로 갈음 가능.

- **[INFO]** `spec/conventions/swagger.md` — 신규 컨트롤러의 Swagger 문서화 요건 미언급
  - target 위치: `§ 변경 후 Side-effect 점검` 항목
  - 위반 규약: `spec/conventions/swagger.md` §2-1 — 새 Controller 에 `@ApiTags` / `@Public()` 엔드포인트 처리, §5-4 체크리스트
  - 상세: spec draft 는 swagger.md 를 "라우트 prefix 직접 참조 없음" 으로 처리했다. swagger.md 는 라우트 prefix 가 아닌 **컨트롤러·DTO 문서화 패턴**을 규정한다. `/api/3rd-party/` 신규 컨트롤러 생성 시 `@ApiTags('3rd-party')` 지정, install/callback 이 `@Public()` 이므로 `@ApiBearerAuth` 제외, 응답 DTO `dto/responses/` 위치 준수 등이 구현 단계에서 요구된다. spec draft 의 side-effect 점검이 이 사항을 명시하지 않으면 developer plan 에서 누락될 수 있다.
  - 제안: `§ 변경 후 Side-effect 점검` 에 "신규 컨트롤러 Swagger 데코레이터 — `spec/conventions/swagger.md` §2 준수 (developer plan 에서 처리)" 한 줄을 추가한다.

---

### 요약

`spec/conventions/migrations.md`(DB 무변경으로 미적용), `spec/conventions/cafe24-api-metadata.md`(Cafe24 Admin API 메타데이터 규약, 해당 영역 아님), `spec/conventions/node-output.md`(노드 핸들러 출력 규약, 해당 없음) 에 대한 위반은 없다. CLAUDE.md 규약 관점에서는 plan frontmatter · Rationale 배치 · side-effect 점검 구조가 전반적으로 충실하게 작성되었다. `spec/4-nodes/4-integration/4-cafe24.md` 의 인라인 개정 blockquote 누적 패턴 한 건이 "latest state" 원칙과 충돌하며, 이를 Rationale 섹션으로 이동하는 것이 유일한 실질적 조치 사항이다.

### 위험도

**LOW** — Critical 위반 없음. WARNING 1건은 spec write 전 Rationale 재배치로 해소 가능.