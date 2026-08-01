# Rationale 연속성 검토 — spec/7-channel-web-chat (impl-done)

## 검토 범위 요약

- target 문서: `spec/7-channel-web-chat`(1-widget-app.md · 2-sdk.md · 3-auth-session.md · 4-security.md ·
  _product-overview.md · 0-architecture.md · 5-admin-console.md) — `## Rationale` 총 10항목(1-widget-app R4~R10) +
  각 문서별 R1~R7 다수를 전수 확인.
- 코드 diff(`git diff origin/main...HEAD -- code_areas`): 10개 워크스페이스 `package.json`의
  `typescript` 선언을 `^7.0.2`/`^7` → `^5.7.3`/`^5` 로 되돌리고, `codebase/frontend/src/lib/repo-guards/__tests__/`
  에 lockstep+capability 가드(`typescript-toolchain-guard.ts` · `typescript-toolchain.test.ts`)를 신설.
  spec/7-channel-web-chat 소유 코드(`code: codebase/channel-web-chat/**`) 안에서 실제로 바뀐 것은
  `codebase/channel-web-chat/package.json` 의 `"typescript": "^7"` → `"typescript": "^5"` **한 줄**뿐.
- 실측: `git log`로 원인 커밋 확인 — `484ee9509`(dependabot PR #1047, `typescript 5.9.3 → 7.0.2` 자동 머지)이
  TS7 의 JS compiler API 표면 이동으로 Jenkins `nest build`·`pnpm install`(sdk `prepare`)을 모두 실패시켰고,
  `5b7d60b97`(`fix(deps): typescript 7.0.2 → 5.x 롤백`)이 이번 브랜치에서 그 자동 bump 를 되돌린다.
  이 경위·근거는 `plan/in-progress/typescript-7-rollback.md`(`spec_impact: none`)에 기록돼 있다.

## 발견사항

- **[INFO]** target 영역과 diff 내용 간 실질적 연관 없음 — 라우팅은 코드소유 매핑의 우연한 겹침
  - target 위치: `spec/7-channel-web-chat` 전체(특히 `code: codebase/channel-web-chat/**` 프런트매터가 가리키는
    `codebase/channel-web-chat/package.json`)
  - 과거 결정 출처: 해당 없음 — 7-channel-web-chat 의 어느 `## Rationale` 항목(1-widget-app R4~R10, 2-sdk R2~R6,
    3-auth-session R3~R6, 4-security R1~R6, _product-overview 2항, 0-architecture R1~R5, 5-admin-console R1~R7)도
    TypeScript 컴파일러 버전·CI 툴체인·의존성 관리 정책을 다루지 않는다. 유일하게 "Jenkins"가 언급되는 곳은
    `0-architecture.md §4.1`("외부 CI(Jenkins 등)는 `docker build` 만 하면 되고")인데, 이는 위젯 co-deploy 빌드
    스테이지 배치에 대한 결정이며 본 diff 는 그 빌드 단계 구조를 전혀 바꾸지 않는다(신설 가드도 `next build` 이전
    `pnpm --filter frontend test` 안에서 도는 기존 테스트 경로를 재사용).
  - 상세: 이 diff 는 spec/7-channel-web-chat 이 다루는 제품 설계(상태기계·인증 토큰 전략·CORS·sanitize·iframe
    격리·i18n·운영 콘솔 외형 저장 등)와 무관한 **monorepo 공용 빌드 툴체인 롤백**이다. dependabot 자동 PR(#1047)이
    깨뜨린 TypeScript major 버전을 원복하고 재발 방지 가드를 추가하는 순수 인프라 수정으로, `codebase/channel-web-chat/package.json`
    한 줄이 이 diff 에 우연히 포함된 것은 "web-chat 이 다른 9개 워크스페이스와 함께 typescript devDependency 를
    선언하는 워크스페이스 중 하나"이기 때문이지, web-chat 제품 로직이 변경돼서가 아니다. 따라서 target 문서의
    `## Rationale`에서 기각된 대안을 재도입하거나, 합의된 설계 원칙을 위반하거나, 근거 없이 과거 결정을 뒤집는 행위
    어느 것도 관측되지 않는다.
  - 제안: target 수정 불필요. 다만 향후 유사 사례(제품 spec 과 무관한 monorepo 전역 diff 가 코드소유 매핑만으로
    특정 spec 영역에 라우팅되는 경우)에서는 통합 SUMMARY 단계에서 "target 영역과 diff 간 실질적 연관성 낮음"을
    명시해, Rationale 연속성 발견사항 0건이 "검토를 못 했다"가 아니라 "대상이 아니다"임을 분명히 하는 것을 권장.

- **[INFO]** 결정 번복의 근거 문서화 자체는 정상 — 다만 위치가 spec 밖(관례상 올바름)
  - target 위치: 해당 없음(spec/7-channel-web-chat 안에는 이 결정에 대한 언급이 없음)
  - 과거 결정 출처: 해당 없음(spec Rationale 에 기록된 결정이 아니라 자동화된 dependabot 머지)
  - 상세: "결정의 무근거 번복"(점검 관점 3) 여부를 확인하기 위해 TS `^7` → `^5` 전환의 근거를 추적한 결과,
    `plan/in-progress/typescript-7-rollback.md` 에 원인 실측(TS7 의 compiler API 이동)·대안 비교·가드 설계
    근거가 상세히 기록돼 있고 `spec_impact: none` 으로 명시돼 있다. 이는 CLAUDE.md 의 정보 저장 원칙("결정의
    배경·근거 → 해당 spec 문서의 `## Rationale`")이 **제품/설계 결정**에 적용되는 것이고, 이번 건은 제품 결정이
    아니라 빌드 툴체인 버그 수정이므로 `plan/`에 기록하는 것이 올바른 배치다. 즉 번복은 발생했으나(TS7 채택 →
    롤백) 그 번복은 애초에 spec Rationale 이 다루는 층위의 결정이 아니었으므로, spec Rationale 갱신 누락으로
    볼 사안이 아니다.
  - 제안: 조치 불요.

## 요약

target `spec/7-channel-web-chat` 의 전체 `## Rationale` 절(1-widget-app R4~R10, 2-sdk R2~R6, 3-auth-session
R3~R6, 4-security R1~R6, _product-overview 2항, 0-architecture R1~R5, 5-admin-console R1~R7)과 함께 제공된
"관련 Rationale 발췌"(0-overview·1-data-model·2-navigation/{workflow-list,integration,knowledge-base,config,
marketplace,user-profile}·3-workflow-editor/{canvas,execution})까지 전수 대조했으나, 어느 곳에도 TypeScript
컴파일러 버전·CI 툴체인·의존성 lockstep 정책에 대한 기존 결정이 없어 이번 diff 와 교차하는 지점이 없다. 실제
diff 는 dependabot 자동 PR #1047(typescript 5.9.3→7.0.2)이 Jenkins 빌드를 깬 것을 원복하고 재발 방지 가드를
신설하는 monorepo 공용 빌드 인프라 수정이며, spec/7-channel-web-chat 소유 코드 안에서는
`codebase/channel-web-chat/package.json` 의 typescript 버전 한 줄만 함께 바뀌었다 — 이는 web-chat 제품 결정의
변경이 아니라 워크스페이스 전체 lockstep 원복의 부수 효과다. 기각된 대안 재도입, 합의 원칙 위반, 무근거 결정
번복, invariant 우회 중 어느 것도 발견되지 않았다. 이 diff 가 spec/7-channel-web-chat 영역으로 라우팅된 것은
`code:` 프런트매터 매핑의 표면적 일치(package.json 파일 하나가 그 디렉터리 아래 있다는 사실)에 따른 것으로
보이며, target 문서의 실질 내용과는 무관하다.

## 위험도

NONE
