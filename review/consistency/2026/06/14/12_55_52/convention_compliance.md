# 정식 규약 준수 검토 — `spec/5-system/_product-overview.md`

검토 모드: 구현 완료 후 검토 (--impl-done)
대상 변경: NF-OB-07 도메인/비즈니스 커스텀 메트릭 항목 신설 + 구현 코드(`BusinessMetricsService` / `MetricsModule` / 계측 지점 3종)

---

## 발견사항

### 위반 없음 (PASS) 항목 요약

아래 항목은 규약을 완전히 준수하고 있어 위반 없음으로 확인됐다.

1. **Frontmatter 면제 적용 정확** — `spec/5-system/_product-overview.md` 는 `_` prefix 파일이므로 `spec-impl-evidence.md §1` 에 의해 `id`/`status` frontmatter 의무에서 명시 면제된다. 면제 규칙의 적용 대상 경로(`spec/<영역>/_*.md`)에 정확히 해당한다.

2. **문서 역할 규약 준수** — `CLAUDE.md` "정보 저장 위치" 규약상 `_product-overview.md` 는 "제품 정의·요구사항" 의 단일 진실로 지정된 위치다. NF-OB-07 행을 §5 관측성 테이블에 추가한 것은 이 역할과 정합한다.

3. **테이블 구조 일관성** — 기존 NF-OB-01~NF-OB-06 행과 동일한 컬럼 형식(`| ID | 요구사항 | 우선순위 | 상태 |`)을 유지하고 있다.

4. **메트릭 이름 표기** — OTel 공식 dot 표기(`clemvion.execution.total` 등)를 사용하고, Prometheus sanitize 규칙(`clemvion_*`)을 카탈로그 주석에 명시했다. 별도 명명 규약 문서가 없는 영역이며, OTel 표준 관행과 일치한다.

5. **구현 파일 명명 규약** — `business-metrics.service.ts` / `metrics.module.ts` (kebab-case), `BusinessMetricsService` / `MetricsModule` (PascalCase) — NestJS 모듈 명명 패턴(`spec/conventions/swagger.md` 등에서 관찰되는 패턴)과 일치한다.

6. **하위 heading anchor 참조 정합** — `spec/5-system/4-execution-engine.md` 가 `./_product-overview.md#nf-ob-07-메트릭-카탈로그` 로 참조하는데, heading `### NF-OB-07 메트릭 카탈로그` 의 slug(`nf-ob-07-메트릭-카탈로그`)와 일치한다.

7. **Rationale 섹션 부재** — `_product-overview.md` 는 요구사항 테이블 집합 문서로, 기술 결정 근거를 담는 "본문 spec 문서"가 아니다. 프로젝트 플래너 SKILL.md 의 "3섹션 권장" 은 일반 spec 문서에 적용되는 권장 사항이며, 순수 PRD 테이블 파일에 Rationale 부재는 규약 위반이 아니다. (실제로 이 파일에는 원래부터 Rationale 섹션이 없었고, 기존 NF-OB-01~06 행도 동일 패턴이다.)

---

### 발견사항

**위반 없음.** 검토 관점 5개(명명 규약, 출력 포맷 규약, 문서 구조 규약, API 문서 규약, 금지 항목) 모두에서 정식 규약 위반이 발견되지 않았다.

- **명명 규약**: 파일명·클래스명·메트릭 이름 모두 규약 준수.
- **출력 포맷 규약**: API 응답/이벤트 페이로드 변경 없음. OTel instrument 출력은 OTel 표준 따름.
- **문서 구조 규약**: `_product-overview.md` 역할에 맞는 요구사항 테이블 추가. frontmatter 면제 적용 정확.
- **API 문서 규약**: 신규 HTTP 엔드포인트 없음. Swagger 데코레이터·DTO 변경 없음.
- **금지 항목**: 명시적으로 금지된 패턴 미발견.

---

## 요약

`spec/5-system/_product-overview.md` 의 NF-OB-07 신설(도메인/비즈니스 커스텀 메트릭 카탈로그)은 정식 규약(`spec/conventions/**`) 관점에서 전면 준수하고 있다. 파일이 `_` prefix 로 frontmatter 의무에서 면제되는 점, PRD 테이블 역할에 맞는 구조, OTel dot 표기 메트릭 이름, NestJS 명명 패턴 준수, 기존 NF-OB-0x 행과 동일한 테이블 컬럼 형식 등 모든 검토 관점에서 규약 이탈이 확인되지 않는다. 구현 코드(`BusinessMetricsService`, `MetricsModule`, 계측 지점 3종)의 파일·식별자 명명 역시 프로젝트 명명 관행과 정합한다.

---

## 위험도

NONE
