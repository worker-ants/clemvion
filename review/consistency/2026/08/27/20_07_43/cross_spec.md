# Cross-Spec 일관성 검토 — `spec/5-system/` (eia-misc-hygiene)

## 검토 범위 확인

`git diff origin/main...HEAD` 실측 결과, 이번 변경은 **spec 내용 자체의 변경이 아니라
코드 경로 참조 갱신 2건 + 위생성 리팩터(rename/파일 이동/공유 테스트 헬퍼 추출)**다.

- `spec/5-system/14-external-interaction-api.md`: frontmatter `code:` 목록 1줄
  (`shared/utils/node-output-allowlist.ts` → `nodes/core/node-output-allowlist.ts`)
- `spec/conventions/egress-masking.md`: frontmatter `code:` 목록 1줄 추가
  (`shared/utils/redact-stored-error.ts`)
- `spec/conventions/node-output.md`: 본문 코드 경로 인용 1줄 동일 갱신
- 나머지는 `codebase/backend/**` 리네임(`redactNodeExecutionRow` →
  `redactNodeExecutionRowForResponse`, 호출부 동반), 파일 이동(`node-output-allowlist.ts`),
  신규 테스트 헬퍼(`shared/testing/swagger-probe.ts`) + `tsconfig.build.json` exclude 추가,
  plan 문서(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 체크박스 갱신.

요구사항 ID·엔드포인트·데이터 모델·상태 머신·RBAC 어느 것도 이번 diff 에서 신설·변경되지
않았다 — 점검 관점 1~5 는 해당 없음(diff 표면에 대상 자체가 없음).

## 발견사항

### [INFO] JSDoc 오기 정정이 dangling 요구사항 ID 참조를 해소
- target 위치: `codebase/backend/src/modules/external-interaction/interaction.guard.ts:27`
  (spec 자체 diff는 아니나 spec 요구사항 ID 를 인용하는 코드 주석)
- 충돌 대상: `spec/5-system/14-external-interaction-api.md` §3.3 (EIA-AU-08 만 실재, `EIA-AU-09` 는
  존재한 적 없는 ID)
- 상세: `[Spec EIA §3.3 EIA-AU-08 + §3.3.1 EIA-AU-09]` → `[Spec EIA §3.3 EIA-AU-08 + §3.3.1]` 로
  정정. `EIA-AU-09` 는 spec 요구사항 표에 존재하지 않는 ID였고(오기), 이번 diff 로 저장소
  전체(spec/codebase 모두, grep 재확인 0건) 잔존이 사라졌다. 이는 새 충돌이 아니라 **기존
  요구사항 ID 불일치(§점검 관점 3)의 해소**다.
- 제안: 조치 불요. 참고로 기록.

### [INFO] 코드 경로 참조 정합 — 이동 후 잔존 stale 참조 없음
- target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter, `spec/conventions/egress-masking.md`
  frontmatter, `spec/conventions/node-output.md` 본문
- 충돌 대상: 저장소 전체 `spec/**`
- 상세: `node-output-allowlist.ts` 를 `shared/utils/` → `nodes/core/` 로 이동하며 두 spec 문서가
  참조를 동반 갱신했다. `grep -rn "shared/utils/node-output-allowlist" spec/` 는 0건, 구 함수명
  `redactNodeExecutionRow`(ForResponse 접미사 없는 구형)도 `spec/` 내 0건 — 다른 spec 문서가
  구 경로/구 이름을 여전히 인용하는 dangling reference 가 없다. `spec-code-paths.test.ts` 가
  `code:` frontmatter 존재를 검사하는 계약과도 정합한다(파일이 실제로 새 경로에 존재함을
  `ls` 로 확인).
- 제안: 조치 불요.

### [INFO] `shared/` 계층 경계 — 이번 이동은 위반이 아니라 국소적 회복
- target 위치: `codebase/backend/src/nodes/core/node-output-allowlist.ts` (이동), 인용:
  `spec/conventions/node-output.md` §정본 열거
- 충돌 대상: (가상의) "shared = 도메인 비의존" 계층 책임 원칙 — 단 이 원칙은 spec 문서에
  명문화된 규약이 아니라 코드베이스 관례(plan 문서 서술)다
- 상세: `node-output-allowlist.ts` 는 `NodeHandlerOutput`(도메인 타입)을 import 하면서도
  기존엔 `shared/utils/` 에 있어 "shared 는 도메인 비의존" 관례와 어긋났다. 이번 이동으로
  `nodes/core/`(그 타입이 사는 디렉토리)로 옮겨 그 특정 파일의 위반은 해소됐다 — 다만 같은
  디렉토리의 다른 파일까지 전수 정합시킨 것은 아니라는 점을 plan 문서·직전 코드리뷰
  라운드(`20_00_08`)가 이미 INFO 로 명시하고 있다. 이 원칙 자체가 `spec/**` 어디에도
  formal SoT 로 없어(검색 결과 없음) cross-spec 충돌 판정 대상이 아니다 — 코드 리뷰
  (maintainability/side_effect) 영역의 발견이며, 해당 라운드에서 이미 "조치 불요"로 처리됨.
- 제안: cross-spec 관점에서는 조치 불요. (이미 code-review 라운드가 다룸.)

### [INFO] 신규 `shared/testing/` 디렉토리는 spec 문서화 대상 밖
- target 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` (신규)
- 충돌 대상: `spec/0-overview.md` §151 ("구체 파일 목록은 본 문서가 박제하지 않는다")
- 상세: 신규 테스트 전용 헬퍼 디렉토리가 생겼으나, `spec/0-overview.md` 를 비롯해 어떤 spec
  문서도 backend `src/` 하위 디렉토리 목록을 고정 열거하지 않는다 — 따라서 갱신 누락으로
  포착될 대상이 없다. `tsconfig.build.json` exclude 추가(devDependency 오염 방지)는
  `src/repo-guards/**` 선례와 같은 패턴이며 관련 spec(swagger 규약 등) 어디도 이 배제 목록을
  정본으로 다루지 않는다.
- 제안: 조치 불요.

## 요약

이번 `eia-misc-hygiene` 변경은 spec 문서 실질 내용(엔티티·API 계약·요구사항 ID·상태
머신·RBAC·계층 책임 원칙 그 자체)을 건드리지 않고, 코드 리팩터(rename·파일 이동·공유 테스트
헬퍼 추출)에 맞춰 spec 의 `code:` frontmatter 및 본문 코드 경로 인용 2곳만 동기화했다.
`spec/**` 전체를 대상으로 구 경로(`shared/utils/node-output-allowlist`)·구 함수명
(`redactNodeExecutionRow`)·오기 요구사항 ID(`EIA-AU-09`)의 잔존을 재확인했고 모두 0건이라,
다른 spec 영역과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은
발견되지 않았다. 유일하게 주목할 만한 것은 `EIA-AU-09` 오기 정정으로, 이는 신규 충돌이
아니라 기존에 존재하던 (실재하지 않는 ID 를 가리키는) dangling 참조의 해소다.

## 위험도

NONE
