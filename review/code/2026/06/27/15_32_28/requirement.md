# 요구사항(Requirement) 리뷰 결과

## 분석 대상

| 파일 | 변경 유형 |
|---|---|
| `codebase/backend/src/modules/llm/llm-model-config.controller.ts` | Controller 하드닝 |
| `plan/complete/web-chat-loader-queue-replay-arguments.md` | Plan frontmatter 교정 |
| `plan/in-progress/refactor/02-architecture.md` | Plan 진행 상황 갱신 |

---

## 발견사항

### [INFO] `ParseEnumPipe` 에 enum 객체 대신 배열 리터럴 전달

- **위치**: `llm-model-config.controller.ts:127` — `new ParseEnumPipe(['chat', 'embedding'], { optional: true })`
- **상세**: 프로젝트의 실제 NestJS 11 구현(`node_modules/@nestjs/common/pipes/parse-enum.pipe.js`)을 확인한 결과 `isEnum` 메서드가 `Object.keys(enumType).map(k => enumType[k])` 로 유효값을 추출한다. 배열 `['chat', 'embedding']`에 이를 적용하면 `Object.keys` = `['0', '1']`, `enumType['0']` = `'chat'`, `enumType['1']` = `'embedding']` 이므로 유효값 집합 = `['chat', 'embedding']`이 되어 **동작은 정확하다**. optional 처리(`isNil(value) && options?.optional` 조기 반환)도 정상 작동한다. 단, 동일 코드베이스 내 `auth.controller.ts`는 `OAUTH_PROVIDER_ENUM` (const 객체)을 전달하는 패턴을 사용하고, NestJS 문서가 공식적으로 enum/const 객체를 요구한다. 향후 NestJS 버전 업그레이드 시 `isEnum` 내부 구현이 바뀌면 조용히 무력화될 수 있다.
- **제안**: `const MODEL_TYPE = { chat: 'chat', embedding: 'embedding' } as const;` 를 파일 상단(또는 공유 위치)에 선언하고 `new ParseEnumPipe(MODEL_TYPE, { optional: true })` 로 교체 — 기존 codebase 패턴과 일치, NestJS 버전 변경에 강건.

---

## 항목별 점검 결과

### 1. 기능 완전성

- `PROVIDER_PROBE_THROTTLE` 상수를 3개 핸들러에 일관 적용: 동작 동치, DRY 개선. 누락 없음.
- `ParseEnumPipe({ optional: true })` 추가로 `type` 쿼리 파라미터의 런타임 유효성 검증 신설: 기존 TypeScript 타입 단언만으로는 `type=foo` 같은 잘못된 입력이 서비스 레이어까지 전달되던 갭이 해소됨.

### 2. 엣지 케이스

| 입력 | 기존 동작 | 변경 후 동작 | 평가 |
|---|---|---|---|
| `type` 파라미터 없음 | undefined 통과 → 서비스 no-filter | `isNil(undefined)` → optional 패스 → undefined | 동일 |
| `type=chat` | 통과 | `isEnum('chat')` → true → 통과 | 동일 |
| `type=embedding` | 통과 | `isEnum('embedding')` → true → 통과 | 동일 |
| `type=foo` | 잘못된 string 이 서비스 레이어 도달 | `isEnum('foo')` → false → 400 BAD_REQUEST | 개선 |
| `type=` (빈 문자열) | 빈 문자열이 서비스 도달 | `isNil('')` = false → `isEnum('')` = false → 400 | 개선 |
| `type=CHAT` (대문자) | 잘못된 값 서비스 도달 | 400 (열거값은 소문자) | 개선, spec와 일치 |

### 3. TODO/FIXME

파일 내 TODO / FIXME / HACK / XXX 없음.

### 4. 의도와 구현 간 괴리

주석 "부속 엔드포인트(preview / test / list-models)는 실시간 provider 호출이라 과금·rate-limit 보호용으로 동일 스로틀 정책을 공유한다 (3 핸들러 단일 SoT)" 와 실제 구현(3곳 동일 `PROVIDER_PROBE_THROTTLE` 참조) 완전 일치.

### 5. 에러 시나리오

- `ParseEnumPipe` 유효성 실패 → 400 BAD_REQUEST (NestJS 기본 HttpStatus.BAD_REQUEST) — 적절.
- 예외 메시지: `'Validation failed (enum string is expected)'` (NestJS 내장 문자열). 유효값 목록이 메시지에 미포함이지만 이는 NestJS `ParseEnumPipe` 의 기본 동작이며 본 변경과 무관.

### 6. 데이터 유효성

변경 전: `@Query('type') type?: 'chat' | 'embedding'` — TypeScript 타입만, 런타임 무검증.
변경 후: `ParseEnumPipe` 런타임 검증 추가 — 명세된 열거값 이외의 문자열을 400으로 차단.

### 7. 비즈니스 로직 (spec 인가 규칙)

`spec/2-navigation/6-config.md §3 Model Config API` 및 `R-7` 검증:

| 엔드포인트 | spec 요구 | 코드 구현 | 정합 |
|---|---|---|---|
| `POST preview-models` | Editor+ (action-POST, 과금 호출) | `@Roles('editor')` | ✓ |
| `POST :id/test` | Editor+ (action-POST, 과금·PATCH 부수효과) | `@Roles('editor')` | ✓ |
| `GET :id/models` | Viewer+ (읽기) | `@Roles` 미적용 (워크스페이스 멤버 인증 레이어만) | ✓ |

### 8. 반환값

세 핸들러 모두 서비스 레이어 반환값을 직접 전달 (`return this.xxx.yyy(...)`). 예외/undefined 처리는 서비스 레이어 책임으로 위임 — 컨트롤러 레이어에서 추가 처리 없이 정상.

### 9. Spec fidelity

**`spec/2-navigation/6-config.md §3 Model Config API`** — 관련 spec 식별 완료.

| spec 요구사항 | 코드 | 판정 |
|---|---|---|
| `POST :id/test` → Editor+ (R-7) | `@Roles('editor')` | ✓ |
| `POST preview-models` → Editor+ (R-7) | `@Roles('editor')` | ✓ |
| `GET :id/models` → Viewer+ (§3 표) | `@Roles` 미적용 | ✓ |
| `GET :id/models` — `type` 필터 (chat/embedding 제한 가능) | `ParseEnumPipe(['chat', 'embedding'], { optional: true })` | ✓ (spec 명시보다 강건한 구현, 일치) |
| throttle 정책 | spec 비명시 (인프라 결정) | spec 침묵 영역 — INFO 해당 없음 |

spec `R-7` Rationale 의 `@ApiForbiddenResponse` 요구도 확인:
- `testConnection`: `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` ✓
- `previewModels`: `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` ✓
- `listModels`: `@ApiForbiddenResponse` 미적용 — spec §3 "조회(GET)는 Viewer+" 이므로 공통 403 인증 레이어 위임이 정확. ✓

---

## plan 파일 점검

**`plan/complete/web-chat-loader-queue-replay-arguments.md`**:
`spec_impact: []` → `spec_impact: none`. `.claude/docs/plan-lifecycle.md §5 Gate C` 스키마는 `none` 을 "spec 변경 불요" 의 정식 키워드로 정의하며 `[]`(빈 배열)는 비표준. 교정 방향이 정확하다.

**`plan/in-progress/refactor/02-architecture.md`**:
C-2 cluster 4 항목에 "PR 대기" → "PR #714 `000d8963` 머지 완료" 및 authz follow-up PR #716 `3e102ed3` 머지 완료 기록. 사실 추적 업데이트, 누락 없음.

---

## 요약

이번 변경은 두 가지 순수 하드닝/DRY 작업이다. (1) 3개 핸들러의 동일 스로틀 정책을 `PROVIDER_PROBE_THROTTLE` 상수 단일 SoT로 정렬 — 동작 동치, 유지보수성 향상. (2) `GET :id/models`의 `type` 쿼리 파라미터에 `ParseEnumPipe` 런타임 열거 검증 추가 — 기존 TypeScript 타입 단언만으로는 막을 수 없었던 `type=foo` 류의 잘못된 입력을 400으로 차단. spec `R-7` 및 §3의 인가 요구사항(`testConnection`/`previewModels` = Editor+, `listModels` = Viewer+)은 모두 정확히 구현됐다. `ParseEnumPipe`에 enum 객체 대신 배열 리터럴을 전달하는 관행이 codebase 내 기존 패턴(`OAUTH_PROVIDER_ENUM` 사용)과 불일치하나, 실제 NestJS 11 구현 확인 결과 동작은 올바르다.

## 위험도

NONE
