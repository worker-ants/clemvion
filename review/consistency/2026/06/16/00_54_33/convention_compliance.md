# 정식 규약 준수 검토 결과

검토 대상: `--impl-done` scope (`spec/1-data-model.md`, `spec/2-navigation/6-config.md`)  
Diff base: `1899c05e`  
검토일: 2026-06-16

---

## 발견사항

### 1. INFO — `spec/2-navigation/6-config.md`: `code:` frontmatter 에 신규 파일 경로 누락

- target 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 배열
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로" 를 담아야 한다
- 상세: 이번 구현에서 `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` 가 신규 추가됐다. 이 파일은 spec §A.2 IP Whitelist 저장 시 형식 검증 약속의 직접 구현체이나, 현재 frontmatter `code:` 의 `codebase/backend/src/modules/auth-configs/**` 와일드카드 glob 이 이미 해당 파일을 포함하고 있어 — 실질적으로 coverage 에서 누락되지 않는다. glob 이 커버하므로 기술 위반은 아니나, 명시 glob 이 이미 포함함을 확인.
- 판정: 위반 없음 (glob 커버).

### 2. INFO — `spec/1-data-model.md`: `spec-impl-evidence` frontmatter 면제 규정 확인

- target 위치: `spec/1-data-model.md` frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — `1-data-model.md` 는 basename 으로 `EXCLUDE_BASENAMES` 에 등재되어 frontmatter 가드 대상이 아님
- 상세: 해당 파일은 spec-impl-evidence 의 명시 제외 목록(`basename '1-data-model.md'`)에 해당한다. frontmatter 의 `id: data-model`, `status: implemented` 는 기존 값 유지. 이번 diff 는 `ip_whitelist` 컬럼 설명에 **저장 시 형식 검증 추가**를 서술하는 한 줄 갱신이며, 문서 구조 위반 없음.
- 판정: 위반 없음.

### 3. INFO — `is-ip-or-cidr.validator.ts`: 커스텀 validator 함수명 대소문자 혼용

- target 위치: `/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`
- 위반 규약: `spec/conventions/swagger.md §1-1` — CLI 플러그인은 DTO 파일(`*.dto.ts`)을 처리. 커스텀 validator 파일(`*.validator.ts`)은 플러그인 자동처리 대상 아님 — 직접 위반은 아니나 패턴 관찰
- 상세: 파일에서 저수준 helper `isIpOrCidr` (camelCase)와 데코레이터 팩토리 `IsIpOrCidr` (PascalCase)를 동일 파일에서 export 하는 것은 NestJS/class-validator 관행에 부합하며 기존 프로젝트 패턴과 일치한다. `ValidatorConstraint` 이름 `'isIpOrCidr'` (camelCase)는 class-validator 문서의 name 필드 표기법과 일치한다. 명명 규약 위반 없음.
- 판정: 위반 없음.

### 4. INFO — `spec/2-navigation/6-config.md` §A.4: 신규 단락 위치의 3섹션 구조 부합 여부

- target 위치: `spec/2-navigation/6-config.md` §A.4 "평문 자동 hide 정책" 신규 단락
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: 추가된 단락(`> 평문 자동 hide 정책은 create / regenerate 의 1회 노출에도 동일 적용된다 — ...`)은 §A.4 "Reveal 흐름" 본문에 blockquote 형태로 삽입됐다. 이는 구현 세부 사항 설명으로 "본문" 섹션에 위치하는 것이 적절하며, Rationale 로 분리할 만한 **결정 배경**이 아닌 **동작 명세** 성격이다. 3섹션 구조와 부합한다.
- 판정: 위반 없음.

### 5. INFO — `update-auth-config.dto.ts`: `@ApiPropertyOptional` description 에 `example` 추가

- target 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` `ipWhitelist` 필드
- 위반 규약: `spec/conventions/swagger.md §1-2` — "예시가 필요한 경우 `@ApiProperty` 추가 보강"
- 상세: 이번 diff 에서 `update-auth-config.dto.ts` 의 `ipWhitelist` `@ApiPropertyOptional` 에 `example: ['10.0.0.0/8', '203.0.113.42']` 가 추가됐다. `create-auth-config.dto.ts` 에는 이미 동일 example 이 있었다. 두 DTO 간 `example` 일관성이 유지되고 있으며, swagger.md 의 "예시 필요 시 보강" 권장을 준수한다.
- 판정: 위반 없음, 올바른 패턴.

### 6. INFO — `spec/1-data-model.md` §2.17 `ip_whitelist` 설명: 에러 코드 미명시

- target 위치: `spec/1-data-model.md` §2.17 `ip_whitelist` 컬럼 설명 신규 문장
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE` 이고 의미 기반 명명
- 상세: 갱신된 설명에서 "400 으로 거부한다" 라고 HTTP 상태 코드만 언급하고 에러 코드 (`VALIDATION_ERROR` 등)를 명시하지 않았다. 그러나 IP Whitelist 형식 검증 실패는 class-validator 를 통한 DTO 검증 실패이므로 `VALIDATION_ERROR` (글로벌 공용 코드, `spec/5-system/3-error-handling.md §1.1` 참조)가 자동 발행된다 — 이 코드는 인프라 수준 공용이라 spec 본문에서 재선언을 강제하지 않는다. 특수 에러 코드가 없으므로 명시 필요 없음.
- 판정: 위반 없음.

---

## 요약

이번 구현(`config-c2-autoclear-isip-1ca382` worktree, diff base `1899c05e`)은 AuthConfig IP Whitelist DTO 저장 시점 형식 검증 추가(`IsIpOrCidr` 커스텀 validator), 생성·재생성 키의 30초 자동 hide(`useEffect` 기반 타이머), 그리고 관련 spec 갱신 2건으로 구성된다. 정식 규약(`spec/conventions/`) 관점에서 CRITICAL 또는 WARNING 수준의 위반 항목이 발견되지 않았다. 명명 규약(파일명 kebab-case, 데코레이터 PascalCase, validator name camelCase), Swagger DTO 패턴(`@ApiPropertyOptional` + `example`), 에러 코드 체계(DTO 검증 실패 = 공용 `VALIDATION_ERROR`), 문서 3섹션 구조, frontmatter spec-impl-evidence 모두 기존 규약과 일치한다. `spec/2-navigation/6-config.md` 의 `code:` glob(`codebase/backend/src/modules/auth-configs/**`)이 신규 `is-ip-or-cidr.validator.ts` 를 커버하므로 frontmatter 갱신도 불필요하다.

---

## 위험도

NONE
