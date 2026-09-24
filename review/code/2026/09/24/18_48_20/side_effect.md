# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `@nestjs/typeorm@12` 는 ESM-only 라 CJS 런타임이 Node 의 `require(esm)` 에 암묵적으로 의존한다 — 이번 라운드에 문서화되어 리스크가 완화됨
  - 위치: `PROJECT.md` (「Node 지원 floor」 항목, `+`로 추가된 문장 — "backend floor 를 내릴 때의 숨은 결속" 부분)
  - 상세: `@nestjs/typeorm@12.0.1` 은 `type: module`(ESM-only)이고 `engines: {node: '>=20.19.0'}` 를 요구한다(`pnpm-lock.yaml` 신규 라인). 이 저장소의 backend 런타임은 CJS 이므로 이 패키지 로드는 Node 의 native `require(esm)` 지원에 의존하게 됐다 — 이는 `@nestjs/typeorm@11`(CJS)에는 없던 새 암묵적 결속이다. `engines` 는 advisory 라 `engines.node` 를 낮춰도 **설치는 조용히 성공하고 부팅 시점에야 깨진다**는 점을 이번 diff 가 `PROJECT.md` 에 명시적으로 적어 두었다(직전 라운드 WARNING 3 의 조치, `8f7d2b836`). 현재 floor(`>=24`)는 충분히 상회하고 e2e 부팅으로 검증됐다고 기록돼 있다.
  - 제안: 조치 불요 — 이미 향후 담당자가 floor 를 만질 때 보게 될 자리(Node 지원 floor 섹션)에 정확히 적혀 있다. 다만 이 문장이 다루는 대상은 "설치 시점에 감지되지 않는 런타임 부팅 실패" 라는 부작용 그 자체이므로, 향후 `engines.node` 하향 PR 에서는 이 문장이 여전히 참인지(=`@nestjs/typeorm` 의 최소 Node 요구 버전이 바뀌지 않았는지) 재확인이 필요하다.

- **[INFO]** `pnpm-lock.yaml` 부수 변경 범위가 직전 라운드 WARNING 1 지적대로 typeorm 관련 라인으로 좁혀짐 — 재발 없음 확인
  - 위치: `pnpm-lock.yaml` (게이트 92-99, 2565-2576, 12443-12450 세 hunk)
  - 상세: 이번 diff 의 `pnpm-lock.yaml` 변경은 `@nestjs/typeorm` 의 specifier/version/resolution/peerDependencies/snapshot 키뿐이며, 직전 라운드에서 지적된 무관 optional 패키지 `libc:` 필드 63줄 삭제나 `eslint-plugin-*` peer 해석 문자열 변경은 이번 diff 에 나타나지 않는다. `deps-typeorm12.md` §B 의 "opcode 단위로 typeorm 변경분만 얹었다"(15줄) 서술과 부합한다. 새로 추가된 `engines: {node: '>=20.19.0'}` 줄(게이트 2570)은 그 자체로 lockfile 메타데이터일 뿐 설치 동작을 바꾸지 않는다(advisory).
  - 제안: 조치 불요.

- **[INFO]** 애플리케이션 소스코드(`codebase/backend/src/**`, `codebase/frontend/**`) 변경 없음 — 함수/클래스 시그니처, 전역 상태, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 경로 모두 diff 밖
  - 위치: 전체 diff(파일 1~32) — package.json 1줄, pnpm-lock.yaml 3-hunk, plan 문서 4개, 그리고 직전 라운드(`18_22_23`)의 review/consistency 산출물 committing
  - 상세: 이번 리뷰 대상 diff 에는 실행 코드가 전혀 포함되지 않는다. `@nestjs/typeorm@12` 의 소비 표면(`TypeOrmModule.forFeature`/`@InjectRepository` 사용처 13개+ 모듈)은 라이브러리 내부 구현이 바뀌는 것이지 이 diff 가 그 호출부 코드를 수정하는 것이 아니다. `review/code/2026/09/24/18_22_23/**` 와 `review/consistency/2026/09/24/17_31_27/**` 신규 파일들은 규약이 정한 위치(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`, `review/consistency/...`)에 정확히 생성된 read-only 검토 산출물이며 `spec/`·`codebase/` 상태를 변경하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 직전 라운드에서 관측됐던 `workspace.decorator.ts` 검증용 뮤턴트 잔존 여부 — 현재 워크트리 재확인 결과 clean
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` (이번 diff 대상 아님)
  - 상세: 직전 라운드 SUMMARY(파일 8, INFO #10) 와 RESOLUTION(파일 7) 이 이 파일의 판별자 뮤테이션이 리뷰 종료 시점엔 원복돼 clean 했다고 기록했다. 이번 리뷰 시작 시점에 `git status --short` 로 재확인한 결과 워크트리는 이번 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/24/18_48_20/`)를 제외하면 clean — 잔존 뮤테이션 없음.
  - 제안: 조치 불요.

## 요약

이번 diff 는 `@nestjs/typeorm` `^11.0.3` → `^12.0.1` 단일 의존성 범프와 그에 따른 `pnpm-lock.yaml` 최소 갱신(typeorm 관련 3-hunk), plan 문서 갱신, 그리고 직전 리뷰/consistency-check 라운드의 산출물이 저장소에 커밋된 것으로 구성된다. 애플리케이션 코드가 전혀 바뀌지 않아 전역 상태·시그니처·인터페이스·환경 변수·네트워크·이벤트 콜백 어느 축에서도 새로운 부작용 표면이 없다. 유일하게 실질적인 "부작용류" 관심사는 `@nestjs/typeorm@12` 가 ESM-only 라 CJS 런타임이 Node 의 `require(esm)` 에 의존하게 된 점인데, 이는 직전 라운드 WARNING 3 로 지적된 뒤 이번 diff 의 `PROJECT.md` 갱신으로 정확한 위치(Node 지원 floor 섹션)에 문서화됐고 e2e 부팅으로 검증됐다. `pnpm-lock.yaml` 의 부수 변경 범위 역시 직전 라운드 WARNING 1 지적대로 typeorm 관련분으로 좁혀져 재발이 없다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
