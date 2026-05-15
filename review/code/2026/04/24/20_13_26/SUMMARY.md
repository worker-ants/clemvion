파일 쓰기 권한을 요청합니다. 승인해 주시면 `review/2026-04-24_20-13-26/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

승인을 기다리는 동안, 보고서 핵심 내용을 먼저 정리합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 스키마 변경 자체는 LOW 수준이나, 기저 구조의 미완된 보안 방어(expression 평가·XSS·SSRF·`.passthrough()` 남용)가 MEDIUM 리스크를 형성

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **Expression 위젯 SSTI/코드 인젝션** — expression 문자열에 형식·깊이 제한 없어 서버 측 평가 시 임의 코드 실행 벡터 | `switchValue`, `subject`/`body` (widget: 'expression') | 핸들러에서 샌드박스 평가, 함수 화이트리스트·깊이 제한·타임아웃 적용 |
| 2 | Security | **HTML 이메일 XSS / 헤더 인젝션** — `bodyType: 'html'` 허용 시 수신자 클라이언트에서 XSS. `to`/`cc`/`bcc`에 `\r\n` 포함 시 헤더 인젝션 | `body`, `to`/`cc`/`bcc` | DOMPurify sanitize, `z.string().email()` 검증 추가 |
| 3 | Security | **첨부파일 `content` SSRF** — "Content / URL" 레이블이며 무제한 `z.string()`. URL fetch 시 내부망 접근 가능 | `attachmentSchema.content` | `https://` 스킴 제한, 사설 IP 차단 |
| 4 | Security | **`.passthrough()` 광범위 사용** — 외부 경계에서 임의 필드 주입 차단 불가 | 두 파일 전반 | 외부 경계에서 `.strict()`/`.strip()` 사용 |
| 5 | Security | **`caseDefSchema.id` 형식 제한 없음** — 포트 라우팅 키로 전파 시 특수문자 삽입 가능 | `switch.schema.ts` `id` | `z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).optional()` |
| 6 | Testing | **`send-email` `.default('')` 경로 미검증** — omit 시 default 채움, 핸들러 `''` 거부 모두 테스트 없음 | `send-email.handler.spec.ts` | 스키마 spec 신규, 핸들러 spec에 빈 문자열 케이스 추가 |
| 7 | Testing | **`switch` `caseDefSchema.id` 스키마 spec 없음** — 스키마(optional) vs 핸들러(runtime-required) 불일치 통합 테스트 부재 | `switch.schema.spec.ts` 없음 | `switch.schema.spec.ts` 신규 작성, 계층 불일치 테스트 추가 |
| 8 | Side Effect | **타입 시그니처 변경으로 raw 캐스팅 위험** — DB JSON을 `as SendEmailConfig`로 직접 캐스팅하는 코드가 있으면 타입·실제값 불일치 | `send-email.handler.ts` | `schema.parse()` 경로 사용 여부 grep 확인 |
| 9 | Requirement | **`id` 공백 문자열 truthy 엣지케이스** — `id: ' '`은 fallback 미발동으로 공백 포트 id 생성 | `caseDefSchema.id` | `.string().trim().optional()` 또는 resolver에서 `c.id?.trim()` |
| 10 | Scope | **7줄 블록 주석 — 코딩 표준 위반** — "one short line max" 위반, plan 문서와 중복 | `switch.schema.ts` `id` 위 주석 | `// spec §8 stable port id — omit → resolver fallback case_${i}` 한 줄로 압축 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | **동적 포트 노드 간 stable-id 패턴 불완전** — `text-classifier` 스키마·핸들러·resolver 3곳 미조치 | `plan/node-schema-audit.md` F-1 | 다음 배치에 F-1 전체 스코프 일괄 처리 |
| 2 | API Contract | **output·config schema `subject` 의도적 비대칭** — output은 `.optional()`, config는 `.default('')`. 혼선 가능 | `send-email.schema.ts` L24 vs L119 | 현행 유지, 파일 내 한 줄 주석으로 차이 명시 |
| 3 | API Contract | **config 직렬화 shape 변경** — 이제 항상 `subject: ""` 키 포함 | `send-email.schema.ts` | API 응답으로 config 직렬화하는 엔드포인트 확인 |
| 4 | Documentation | **`.default('')` 변경 이유 스키마에 미기재** — LLM 행동 제약 의도가 plan에만 존재 | `send-email.schema.ts` L116, L120 | `// LLM이 optional로 오인해 omit하는 것을 방지` 추가 |
| 5 | Documentation | **plan 문서 하드코딩 라인 번호** — `handler.ts:324,402`는 즉시 무효화됨 | `plan/node-schema-audit.md` F-1 | 심볼 기반 참조로 교체 |
| 6 | Documentation | **F-2 의사결정 미완** — "(a)가 하위 호환 우수"로 끝나고 최종 결정 없음 | `plan/node-schema-audit.md` F-2 | 보류 상태 명시 또는 결정 날짜 기록 |
| 7 | Side Effect | **`.default('')`는 `null`에 미적용** — DB에 `null` 저장 레코드 있으면 ZodError | `send-email.schema.ts` | DB `null` 존재 여부 확인, 필요 시 `.nullable().default('')` |
| 8 | Requirement | **F-1 resolver 패턴 불일치** — plan은 `&&` 체인 제안, switch는 `\|\|` falsy 체크 사용 | `plan/node-schema-audit.md` F-1 | `c.id?.trim() \|\| 'case_${i}'`로 통일 |
| 9 | Maintainability | **plan F-1·F-5 text-classifier 항목 분산** — 동일 파일·스키마 대상이나 우선순위만 다르게 분리 | `plan/node-schema-audit.md` | F-5를 F-1 스코프에 병합 |
| 10 | Architecture | **`http-request.keyValueSchema` `.passthrough()` 누락 (F-4)** — 저장 데이터 조용한 strip 위험 | `http-request.schema.ts` | 다음 schema 커밋에 1줄 수정 포함 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | Expression SSTI, HTML XSS/헤더 인젝션, SSRF, `.passthrough()` 남용, `id` 형식 미제한 |
| Testing | LOW | `.default('')` 경로 미검증, `caseDefSchema.id` 스키마 spec 없음, 계층 불일치 통합 테스트 부재 |
| Requirement | LOW | `id` 공백 truthy 엣지케이스, F-1 resolver 패턴 불일치, F-3 타입 분기 미결 |
| Scope | LOW | 7줄 블록 주석 코딩 표준 위반 |
| Side Effect | LOW | 타입 시그니처 변경, `null` 저장 레코드 ZodError 가능성 |
| Maintainability | LOW | 인라인 주석 외부 참조 stale 위험, plan 항목 분산 |
| Documentation | LOW | `.default('')` 이유 미기재, 하드코딩 라인 번호, F-2 미결 |
| API Contract | LOW | config 직렬화 shape 변경, output·config 비대칭 |
| Architecture | LOW | text-classifier stable-id 미적용으로 동적 포트 노드 간 불일치 |
| Dependency | NONE | 신규 패키지 없음 |
| Performance | NONE | 런타임 성능 변화 없음 |
| Concurrency | NONE | 동시성 무관 |
| Database | NONE | DB 변경 없음 |

---

## 발견 없는 에이전트
- **Concurrency** — 순수 Zod 스키마 정의 변경, 공유 상태·비동기 흐름 없음
- **Database** — DB 쿼리·마이그레이션·엔티티 변경 없음
- **Performance** — 모듈 로드 시 1회 실행되는 정적 변경, 측정 불가 수준 차이

---

## 권장 조치사항

1. **[즉시] `caseDefSchema.id` 슬러그 형식 제약 추가** — `z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).optional()`
2. **[즉시] `switch.schema.ts` 블록 주석 한 줄로 압축** — 코딩 표준 위반 해소
3. **[단기] 핸들러 레이어 보안 방어 검증** — expression 샌드박스, HTML sanitize, SSRF 차단 일괄 점검
4. **[단기] `.passthrough()` 사용 범위 재검토** — 외부 입력 경계에서 `.strict()`/`.strip()` 적용
5. **[단기] 스키마 테스트 파일 신규 작성** — `send-email.schema.spec.ts`, `switch.schema.spec.ts`
6. **[단기] `send-email.handler.ts` raw 캐스팅 grep** — `schema.parse()` 경로 사용 여부 확인
7. **[단기] `.default('')` 인라인 주석 추가** — LLM 행동 제약 의도 명시
8. **[단기] DB `null` 레코드 확인** — 필요 시 `.nullable().default('')` 적용
9. **[follow-up] plan F-1 완료** — text-classifier stable-id 스키마·resolver·핸들러·테스트 일괄 조치
10. **[follow-up] plan 문서 정비** — F-1·F-5 병합, F-2 결정 명시, 라인 번호 → 심볼 참조 교체