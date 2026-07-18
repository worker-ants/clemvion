# Security Review — interaction-type 가드 정규식 → TS AST 파싱 전환

## 검토 범위

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (핵심 변경): enum 값의 string literal 존재 여부를 `new RegExp(['"\`]${value}['"\`])` 정규식 매칭에서 TypeScript 컴파일러 API(`ts.createSourceFile` + `ts.forEachChild`) 기반 AST 파싱으로 교체. 자체 self-test(`collectCodeStringLiterals` describe 블록) 추가.
- `plan/in-progress/interaction-type-guard-comment-false-negative.md` (신규 plan 문서)
- `review/consistency/2026/07/17/19_54_00/**` (5개 checker 산출물 + SUMMARY + meta/retry-state) — 모두 read-only 리뷰 산출물

모든 변경 대상은 **로컬 CI/테스트 실행 시에만 동작하는 개발 도구 코드**이며, 프로덕션 런타임 경로(서버 요청 처리, 사용자 입력 처리, 네트워크 I/O, DB 접근, 인증/인가)를 전혀 포함하지 않는다.

## 상세 분석

1. **인젝션 취약점**: `readFileSync(join(__dirname, "../../../../../", relPath), "utf-8")` 에서 `relPath` 는 `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 하드코딩 배열의 리터럴 값만 순회하며, 사용자 입력이나 외부 데이터에서 유래하지 않는다 — 경로 탐색 위험 없음. `ts.createSourceFile` 은 파싱만 수행하고 평가(eval)하지 않으므로, 설령 대상 파일 내용이 조작되어도 임의 코드 실행으로 이어지지 않는다(TS AST 파서는 안전한 정적 분석기).
2. **하드코딩된 시크릿**: 신규/변경 코드, plan 문서, consistency 산출물 어디에도 API 키·비밀번호·토큰·인증서 패턴 없음.
3. **인증/인가**: 해당 없음 — 테스트/문서 변경으로 인증·인가 로직 미포함.
4. **입력 검증**: 검사 대상 `ENUM_VALUES`/`SOURCE_ENUM_VALUES` 는 `interaction-type-registry.ts` 소스 모듈에서 import 되는 컴파일타임 상수이며 런타임 사용자 입력이 아니다. 이전 구현의 `new RegExp(`['"\`]${value}['"\`]`)` 는 `value` 를 이스케이프 없이 정규식 리터럴에 삽입하는 패턴이라 일반적으로 regex-injection/ReDoS 우려가 제기될 수 있는 형태이나, `value` 가 고정된 내부 enum 문자열(`form`/`buttons`/`ai_conversation`/`ai_form_render`/`system_error`/`rag` 등, 특수 정규식 메타문자 없음)뿐이라 실질 익스플로잇 가능성은 없었고, 이번 변경으로 그 패턴 자체가 완전히 제거되어(AST 노드 비교로 대체) 해당 이론적 표면도 함께 사라졌다 — 긍정적 부수 효과.
5. **OWASP Top 10**: 프로덕션 공격 표면(웹 요청, 인증, 세션, 접근 제어)과 무관한 CI 전용 정적 분석 테스트라 OWASP Top 10 카테고리 대부분이 적용되지 않는다.
6. **암호화**: 해당 없음 — 해시/암호화/평문 전송 로직 없음.
7. **에러 처리**: `throw new Error(...)` 메시지는 누락된 registry site 경로와 enum 값만 노출하며, 이는 이미 저장소 소스에 공개된 정보(파일 경로·enum 값)라 민감 정보 노출이 아니다.
8. **의존성 보안**: 신규 의존성 추가 없음 — `typescript` 는 frontend 의 기존 devDependency(`^5`, 이미 `package.json` 에 선언)를 재사용. `ts.createSourceFile`/`forEachChild`/`isStringLiteral`/`isNoSubstitutionTemplateLiteral` 는 TypeScript 컴파일러의 공개 안정 API로 알려진 취약점 없음.

plan 문서(`interaction-type-guard-comment-false-negative.md`)와 consistency 리뷰 산출물(`review/consistency/2026/07/17/19_54_00/**`)은 순수 문서/보고서로, 코드 실행 경로가 없고 시크릿·PII 노출도 없음.

## 발견사항

없음.

## 요약

이번 변경은 프로덕션 런타임과 무관한 프론트엔드 devtest 가드(`interaction-type-exhaustiveness.test.ts`)를 정규식 텍스트 매칭에서 TypeScript 컴파일러 AST 파싱으로 교체하는 순수 테스트-인프라 개선과, 그에 수반된 plan/consistency-review 문서 추가로 구성된다. 사용자 입력·네트워크·인증/인가·시크릿·암호화·DB 접근 어느 표면도 건드리지 않으며, 파일 경로는 하드코딩된 상수 배열만 순회하므로 경로 탐색 위험이 없다. 오히려 이전 구현이 내재했던(익스플로잇 불가능한 수준이지만) 값-삽입식 정규식 생성 패턴이 이번 전환으로 완전히 제거되어 이론적 표면도 함께 줄었다. 신규 의존성 도입도 없다. 보안 관점에서 조치가 필요한 발견사항은 없다.

## 위험도

NONE
