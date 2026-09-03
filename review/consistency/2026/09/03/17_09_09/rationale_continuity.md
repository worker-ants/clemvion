# Rationale 연속성 검토

## 검토 범위 요약

- scope 는 `spec/5-system/` 이나 이 브랜치의 spec 델타는 0개 파일(정상 — 코드 전용 변경).
- 실제 구현 diff(11 파일/361줄)는 다음 두 그룹으로 구성된다:
  1. TypeORM 엔티티 9개(`execution` · `knowledge-base` · `node-execution` · `node` · `notification` · `schedule` · `trigger` · `user` · `workflow`)의 컬럼 TS 타입을 `nullable: true` DB 스키마에 맞춰 `| null` 로 넓히는 타입 정합화. `@Column` 옵션 자체(스키마·마이그레이션)는 변하지 않았다 — 이미 `nullable: true` 였던 컬럼의 **타입 표기만** 뒤늦게 따라간 것이다.
  2. `redact-stored-error.ts`/`redact-stored-error.spec.ts` — 위 엔티티 변경으로 무너진 기존 전제("두 컬럼은 정적으로 non-null")를 코드 주석에서 취소선(`~~...~~`)으로 **원문을 보존한 채** 정정하고, 실측(`tsc --noEmit` 오류 0)과 날짜(2026-09-03)를 함께 기록했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

이 diff 는 `spec/5-system/*.md` 및 관련 발췌(`spec/1-data-model.md`, `spec/data-flow/10-triggers.md` 등)의 `## Rationale` 에 기록된 어떤 기각된 대안도 재도입하지 않으며, 합의된 설계 원칙(§5.4 부재 표현 규칙, §5.2 비-페이징 컬렉션 유지, install_token/트리거 endpointPath 등 관련 Rationale 항목들)과도 충돌하지 않는다. 대상 필드는 응답 DTO/wire 계약이 아니라 내부 TypeORM 엔티티의 TS 타입이며, DB 스키마(`nullable: true`)는 diff 이전부터 이미 그 상태였다 — 즉 이번 변경은 새로운 결정이 아니라 오랫동안 어긋나 있던 타입 표기를 실제 스키마에 맞춘 정합화다.

`redact-stored-error.ts`/`.spec.ts` 의 주석 정정은 오히려 이 checker 의 관점 3("결정의 무근거 번복")을 **모범적으로 충족**하는 사례다 — 과거 주장("엔티티가 non-null 로 선언하므로 정적으로 null 불가")을 뒤집으면서, 원문을 취소선으로 남기고 무엇이 바뀌었는지("그 컬럼들은 DB 에서 처음부터 `nullable: true` 였고 타입만 안 적었다")와 날짜·검증(`tsc --noEmit` 실측)을 함께 적었다. 이는 spec `## Rationale` 항목은 아니지만(코드 주석), CLAUDE.md 가 spec 자기반증형 소정정에 요구하는 것과 동일한 패턴(원문 보존 취소선 + 실측 + 날짜)을 자발적으로 따르고 있다.

### INFO — 참고 (조치 불요)

- `spec/1-data-model.md` 의 `## Rationale` 은 과거 엔티티/컬럼 서술 정정(예: `alert_rule` 등재, `WorkflowVersion.snapshot` 서술 정정)이 있을 때마다 항목을 추가해 온 관행이 있다. 이번 변경은 **문서 서술 자체를 정정하는 것이 아니라 이미 문서(DB 스키마)와 일치하던 코드 타입을 뒤늦게 맞춘 것**이라 스펙 본문에 오류가 있었던 것은 아니므로 Rationale 신규 항목이 필수는 아니다. 다만 이후 유사한 "엔티티 nullable 배치" 작업이 이어진다면(주석이 "배치 2" 라 명명한 것으로 보아 향후 배치가 더 있을 가능성), 그 시점에 `spec/1-data-model.md` 에 "엔티티 TS 타입은 `nullable: true` 컬럼과 동기화한다" 는 관례를 한 줄로 명문화해 두면 다음 배치 리뷰에서 이 검토를 반복하지 않아도 된다 — 강제 사항은 아니다.

## 요약

이번 diff(엔티티 nullable 타입 정합화 9건 + `redact-stored-error` 주석 자기정정 2건)는 `spec/5-system/` 및 연관 spec 문서의 `## Rationale` 에 기록된 기각 대안·합의 원칙·시스템 invariant 어느 것과도 충돌하지 않는다. 컬럼 nullability 자체(DB 스키마)는 바뀌지 않았고 TS 타입 표기만 실제와 맞췄으며, 이로 인해 무너진 기존 코드 주석의 전제는 원문 보존 + 실측을 갖춘 정정으로 즉시 반영됐다. Rationale 연속성 관점에서 이 변경을 막을 근거가 없다.

## 위험도

NONE
