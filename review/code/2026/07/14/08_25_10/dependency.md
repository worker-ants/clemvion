# 의존성(Dependency) 리뷰

대상: `package.json`(pnpm 필드 제거) · `pnpm-workspace.yaml`(overrides/onlyBuiltDependencies 신설) · `PROJECT.md` · `plan/in-progress/pnpm-migration-followups.md` — pnpm 10.23 이 더 이상 읽지 않는 `package.json`의 `pnpm.overrides`/`pnpm.onlyBuiltDependencies` 를 `pnpm-workspace.yaml`(pnpm 10 정규 위치)로 옮기는 기계적 이전.

독립 검증을 위해 다음을 직접 재현했다(diff·서술 신뢰가 아닌 실측):

- `pnpm-workspace.yaml` 을 `js-yaml` 로 직접 파싱해 `overrides` 20건 · `onlyBuiltDependencies` 5건이 모두 올바른 key/value 문자열로 해석되는지 확인
- 이전(git 상 직전 커밋) `package.json`의 `pnpm.overrides`/`pnpm.onlyBuiltDependencies` 20+5건과 신규 파싱 결과를 1:1 대조
- 저장소의 `pnpm-lock.yaml` 최상단 `overrides:` 블록을 직접 grep — `pnpm-workspace.yaml` 내용과 완전히 동일함을 확인(태스크 설명의 "byte-identical 재해소" 주장을 파일 레벨에서 재확인)
- 저장소 전체에서 `pnpm.overrides`/`pnpm.onlyBuiltDependencies`/`//swagger-pin` 등 옛 위치를 참조하는 잔존 문서·스크립트가 있는지 grep

## 발견사항

- **[INFO]** overrides 20건 · onlyBuiltDependencies 5건 전건 누락·오타 없이 전사(transcribe) 완료 — 실측 확인
  - 위치: `pnpm-workspace.yaml` (신규 `overrides:`, `onlyBuiltDependencies:` 블록)
  - 상세: `js-yaml`로 독립 파싱한 결과, `lodash`~`@nestjs/swagger`까지 20개 override 키·값과 `isolated-vm`~`@tailwindcss/oxide` 5개 onlyBuiltDependencies 항목이 이전 `package.json`의 `pnpm` 필드 내용과 정확히 일치했다. `pnpm-lock.yaml` 최상단 `overrides:` 블록도 동일 20건을 그대로 반영하고 있어(재해소가 실제로 이 파일을 읽었다는 방증), 값 변경·항목 누락·순서 오류 없음을 이중으로 확인했다.
  - 제안: 없음 (정상)

- **[INFO]** YAML 특수 키 quoting 이 모두 올바르게 처리됨
  - 위치: `pnpm-workspace.yaml` overrides 블록의 `"@grpc/grpc-js"`, `"@babel/core"`, `"@nestjs/swagger"`, onlyBuiltDependencies 의 `"@swc/core"`, `"@tailwindcss/oxide"`, 그리고 `"undici@>=7.0.0 <7.28.0"`
  - 상세: YAML 플레인 스칼라는 `@`로 시작할 수 없으므로(예약 지시자) `@`-prefixed 패키지명은 반드시 quoting 이 필요한데 전부 올바르게 큰따옴표 처리됐다. `undici@>=7.0.0 <7.28.0` 키는 공백·`<`·`>`·`=` 등 특수문자를 포함해 quoting 이 필수인데 정확히 처리됐고, 파싱 결과 하나의 완전한 문자열 키로 유지되어 pnpm 의 버전-레인지-스코프 override 문법(`pkg@range: newRange`)이 그대로 보존됨을 확인했다(파싱 후 `"undici@>=7.0.0 <7.28.0": "^7.28.0"` 형태로 정확히 남아있어 backend 의 direct `^6` 계열은 스코프 밖으로 영향받지 않는다). 반면 `next>postcss`는 quoting 없이도 유효한데(`n`으로 시작해 예약 지시자 저촉 없음), 실제로 unquoted 로 남아있고 파싱 결과도 정상 — 불필요한 과잉 quoting 도 없어 스타일 일관성도 양호하다.
  - 제안: 없음 (정상)

- **[INFO]** `//swagger-pin` JSON pseudo-comment → 네이티브 YAML comment 로 전환 (개선, 부수 효과 낮음)
  - 위치: `pnpm-workspace.yaml` `"@nestjs/swagger": 11.2.7` 항목 바로 위 `# swagger-pin: ...` 주석
  - 상세: JSON은 주석을 지원하지 않아 이전에는 `"//swagger-pin"` 같은 pseudo-key 로 우회했으나, YAML은 네이티브 주석을 지원하므로 이번 이전에서 실제 주석으로 전환됐다. 저장소 전체를 grep 한 결과 `//swagger-pin`/`//overrides`/`//onlyBuiltDependencies` 문자열을 프로그램적으로 파싱·의존하는 스크립트·CI 설정은 없어(전부 사람이 읽는 리뷰 산출물·plan 문서에서만 인용) 회귀 위험은 없다. 다만 향후 "핀 사유를 기계적으로 추출"하는 도구를 만들 계획이 있다면 주석은 파싱 대상에서 제외되므로 참고.
  - 제안: 없음 (informational)

- **[INFO]** 신규 외부 의존성 0건 — 순수 설정 위치 이전
  - 위치: `package.json`, `pnpm-workspace.yaml`
  - 상세: 이번 diff는 어떤 패키지도 추가/제거하지 않는다(값 변경 없음, `pnpm-lock.yaml` 재해소 결과도 byte-identical). 따라서 라이선스 호환성·번들 크기·빌드 시간·신규 취약점 표면 관점에서 이번 변경 자체가 유발하는 리스크는 없다. `onlyBuiltDependencies` 5건(isolated-vm/bcrypt/esbuild/@swc/core/@tailwindcss/oxide) 도 각각 네이티브 바인딩·컴파일러·CSS 엔진으로 설명 가능한 정당한 빌드 스크립트 허용 목록이며 이전 과정에서 항목이 추가되거나 빠지지 않았다.
  - 제안: 없음 (정상)

- **[INFO]** 기존 WARNING("pnpm 필드 무시로 인한 보안 핀 거버넌스 공백", `review/code/2026/07/14/00_33_41/dependency.md` #1) 정식 해소
  - 위치: `pnpm-workspace.yaml`, `PROJECT.md` §버전·도구 정책, `plan/in-progress/pnpm-migration-followups.md` §1
  - 상세: 직전 리뷰 라운드(00_33_41)에서 지적된 "non-frozen `pnpm install` 시 20건의 보안 핀이 조용히 사라질 수 있다"는 WARNING이 이번 PR로 근본 해소됐다. `PROJECT.md`의 버전 핀 정책 안내도 `pnpm-workspace.yaml`을 정규 위치로 갱신해 문서-실체 불일치도 함께 해소됨을 grep 으로 확인했다(옛 위치를 현재형으로 안내하는 잔존 문서 없음).
  - 제안: 없음 (정상, 후속 조치 완료 확인)

- **[WARNING]** (신규 아님, 승계) `@nestjs/swagger` exact pin(11.2.7)이 보안 패치 적용을 계속 차단 중
  - 위치: `pnpm-workspace.yaml` `overrides."@nestjs/swagger"`
  - 상세: 이번 diff는 이 핀의 위치만 옮겼을 뿐 값·리스크는 그대로 승계한다. `plan/in-progress/pnpm-migration-followups.md` §2에 이미 별도 focused PR로 분리 추적 중이며(신규 devDep `openapi3-ts` 도입 + deep-import 교체가 선행 조건), 이번 diff의 책임 범위 밖이라는 점도 plan에 명시돼 있다. 회귀는 아니나 dependency 리뷰 관점에서 미해결 상태임을 다시 표기한다.
  - 제안: 별도 추적 중인 §2 작업(deep-import → openapi3-ts 교체 후 11.4.x 상향)을 우선순위에 맞게 진행. 이번 PR에서 추가 조치 불필요.

## 요약

`pnpm.overrides`/`pnpm.onlyBuiltDependencies`를 `package.json`에서 `pnpm-workspace.yaml`로 옮기는 순수 기계적 이전으로, 신규 의존성 추가나 버전 변경이 전혀 없다. 직접 YAML 파싱·lockfile 대조로 재검증한 결과 override 20건·onlyBuiltDependencies 5건이 누락·오타·quoting 오류 없이 완전히 보존됐으며, `@`-prefixed 키·공백/범위 포함 키(`undici@>=7.0.0 <7.28.0`)의 quoting 도 YAML 문법상 정확하다. 이번 변경은 직전 리뷰 라운드에서 지적된 "핀이 lockfile 관성으로만 유지되는 거버넌스 공백" WARNING을 정식으로 닫는다. 유일하게 승계되는 미해결 항목은 `@nestjs/swagger` 11.2.7 exact pin(보안 패치 영구 차단 위험)이며, 이는 이번 diff가 유발한 것이 아니라 이미 별도 plan(§2)으로 추적 중인 기존 이슈다.

## 위험도

LOW
