# 보안(Security) 리뷰

## 리뷰 대상

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

두 파일 모두 `plan/` 트리(저장소 내부, 신뢰된 컨트리뷰터가 작성하는 markdown)를 스캔해
라이프사이클 불변식을 검증하는 **테스트/빌드-타임 도구 코드**다. 외부 사용자 입력·네트워크
경계·인증 계층이 개입하지 않으며, 런타임 프로덕션 코드 경로가 아니다. 이 컨텍스트를
전제로 아래 항목을 점검했다.

### 발견사항

- **[INFO]** 동적으로 구성되는 정규식이지만 현재 호출부는 상수 리터럴만 사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196` (`rawScalar` 정의), 호출부 `:280`
  - 상세: `rawScalar(block, key)` 는 `key` 를 이스케이프 없이 `new RegExp(\`^[ \t]*${key}:[ \t]*(.*)$\`, "m")` 문자열에 직접 보간한다. `key` 가 정규식 특수문자(`.`, `*`, `(` 등)를 포함하면 의도치 않은 매칭이나 예외를 유발할 수 있는 전형적 "regex injection" 패턴이다. 다만 이 함수는 `export` 되어 있지 않고(모듈 비공개), 저장소 전체에서 호출부가 `rawScalar(block, "started")` 단 한 곳뿐이라 `key` 는 항상 하드코딩된 리터럴이다 — 현재는 도달 불가능한 이론적 표면이다.
  - 제안: 당장 수정 불필요. 다만 향후 이 헬퍼에 동적 `key` 를 넘기는 호출부가 추가될 가능성을 차단하려면 `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 이스케이프하거나, JSDoc 에 "key 는 리터럴 필드명만 허용" 이라고 명시해 계약을 고정하는 것을 권장.

- **[INFO]** `spec_impact` 경로 목록으로 임의 상대경로 존재 여부를 검사(경로 탐색 표면이나 신뢰 경계 밖 접근 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:110-112` (`each spec_impact spec path exists` 테스트), `hasValidSpecImpact` 의 `specExists` 콜백(`:53`)
  - 상세: `fs.existsSync(path.join(root, p))` 에서 `p` 는 완료된 plan 문서의 frontmatter `spec_impact` 리스트 값이며 이스케이핑·화이트리스트 없이 그대로 `path.join` 에 들어간다. `p` 가 `../../etc/passwd` 같은 값이면 `root` 밖의 임의 경로 존재 여부를 검사할 수 있다. 다만 (a) `p` 의 출처는 저장소에 커밋된 markdown 이라 이미 쓰기 권한을 가진 컨트리뷰터만 통제할 수 있고, (b) 실행 결과는 boolean(존재 여부)만 assertion 실패 메시지로 노출되며 파일 내용 자체는 유출되지 않고, (c) 이 코드는 프로덕션이 아닌 vitest 실행 컨텍스트에서만 동작한다. 신뢰 경계를 넘는 실질적 공격 표면은 아니다.
  - 제안: 방어적 차원에서 `spec_impact` 값을 `spec/` 하위 경로로 제한(`p.startsWith("spec/") && !p.includes("..")` )하는 것도 고려할 수 있으나, 현재 위협 모델상 필수는 아니다.

- **[INFO]** YAML frontmatter 파싱에 `gray-matter`(내부적으로 `js-yaml`) 사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:123` (`matter(raw, {})`)
  - 상세: YAML 파서는 과거 `!!js/function`/`!!python/object` 등 커스텀 태그를 통한 임의 코드 실행 취약점 계열이 알려져 있다. `js-yaml` 4.x 이상은 기본적으로 안전한 스키마(`DEFAULT_SCHEMA`, 코드 실행 태그 비활성)를 사용하므로 기본 설정(`{}`)에서는 이 벡터가 닫혀 있다. 입력 또한 저장소 내 신뢰된 markdown 파일이라 위협 모델상 우선순위는 낮다.
  - 제안: `package.json` 의 `gray-matter`/`js-yaml` 버전이 최신(안전 스키마 기본값을 갖는 버전)인지만 의존성 감사 시 주기적으로 확인.

## 요약

두 파일은 프로덕션 런타임이 아닌 저장소 내부 라이프사이클 불변식을 검증하는 테스트/빌드 도구 코드로, 외부 사용자 입력·인증·네트워크 경계가 없다. SQL/커맨드/XSS 인젝션, 하드코딩 시크릿, 인증/인가 결함, 안전하지 않은 암호화는 발견되지 않았다. 정규식 동적 구성과 `path.join` 에 frontmatter 값을 그대로 사용하는 지점이 이론적으로 존재하나 모두 신뢰된 저장소 컨텐츠만을 입력으로 받고 현재 도달 가능한 악용 경로가 없어 INFO 수준에 그친다. `matter(raw, {})` 단일 진입점화, `.trim()` 공백-only 값 방지, ISO 날짜 라운드트립 검증 등 오히려 기존의 조용한 검증 우회(placeholder, invalid date rollover)를 막는 방향의 개선이 다수 포함되어 있어 보안 측면에서 긍정적이다.

## 위험도

NONE
