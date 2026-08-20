# 문서화(Documentation) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17, 라운드 4/누적)

## 검토 방법

이번 라운드(`02_04_38`)의 프롬프트는 `origin/main` 대비 브랜치 전체 누적 diff(80여 파일)를
실었으나, 그중 실질 애플리케이션 코드·문서 콘텐츠는 앞선 4개 리뷰 라운드
(`00_03_57`→`00_39_27`→`01_15_47`→`01_38_26`)에서 이미 문서화 관점으로 반복 검토되어
전부 NONE/LOW 로 수렴한 상태였다. `git show --stat 54142453c` 로 실측한 결과, 이번 라운드가
새로 추가한 유일한 프로덕션/테스트 코드는 다음 2개 신규 파일뿐이다 (나머지는 이전 라운드들의
review 산출물 커밋):

- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)

이 2개 파일을 `Read`/`grep`으로 직접 열어 대조했다. 나머지 78개 파일(review/consistency 산출물,
CHANGELOG, spec, plan)은 이전 라운드 documentation.md 4건이 이미 상세 검토를 마쳤고 이번
라운드에서 내용 변경이 없어 재검토 대상에서 제외했다(중복 방지).

## 발견사항

- **[INFO]** 신규 가드 파일의 자기 참조(self-listing) 주석이 실제 매칭 메커니즘을 부정확하게 설명한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:35`
    (`// 이 가드 자신 — 이름을 상수/픽스처로 들고 있다.`)
  - 상세: `ALLOWED_DIRECT_CALLERS` 는 자기 자신(`masked-reject-callers-guard.ts`)을 목록에
    포함하며 그 이유를 "이름을 상수/픽스처로 들고 있다"고 적었다. 실제로 `node`로
    `importsBaseFn(fs.readFileSync('masked-reject-callers-guard.ts'))` 를 재현해 확인한 결과,
    이 파일이 스스로를 "base 를 import 하는 파일"로 잡히게 만드는 원인은 `BASE_FN = 'resolveTriggerParameters'`
    상수 선언(11행)이 아니라, `importsBaseFn` 함수 바로 위 예시 주석(73행:
    `` // `import { ..., resolveTriggerParameters, ... } from '...'` 의 named 목록 안에서만 찾는다. ``)
    이 우연히 `import\s*\{[\s\S]*?\}\s*from` 정규식 형태와 일치하기 때문이다. 실제로 73행의
    그 예시 문구만 제거하면(상수 `BASE_FN` 선언은 그대로 두어도) `importsBaseFn` 은 이 파일에
    대해 `false` 를 반환한다 — 즉 파일이 스스로를 허용목록에 넣어야 하는 진짜 이유는 "상수를
    보유해서"가 아니라 "설명용 예시 주석이 import 블록 모양과 우연히 겹쳐서"다. 이 파일 자체가
    "언급이 아니라 import 만 본다"는 정밀성을 핵심 설계 근거로 내세우는데, 정작 자신의
    자기참조 이유를 설명하는 주석은 그 정밀성 기준에 못 미친다.
  - 영향은 낮다 — 같은 파일이 이미 갖춘 "죽은 허용목록 항목" 캐너리 테스트
    (`masked-reject-callers.spec.ts` `[캐너리] 허용목록 항목이 전부 실제 스캔에 잡힌다`)가
    안전망 역할을 한다. 누군가 73행 주석의 표현을 "명확하게 다듬으려고" import 블록 모양이
    아닌 형태로 바꾸면(예: 코드 스타일이 아닌 산문으로), 이 파일은 더 이상 자기 자신을
    매칭하지 않게 되어 목록의 자기 항목이 "죽은 항목"으로 판정되고 그 캐너리가 RED 를 낸다.
    다만 RED 를 처음 마주친 사람이 35행 주석("상수/픽스처")만 읽으면 `BASE_FN` 삭제를 의심하며
    엉뚱한 곳을 고칠 수 있다 — 진짜 원인(73행 예시 주석의 우연한 형태 일치)을 찾기까지 시간이
    걸린다.
  - 제안: 35행 주석을 "이 가드 자신 — `importsBaseFn` 설명 예시 주석(아래)이 import 블록
    형태와 우연히 일치해 스스로도 매칭된다" 처럼 실제 메커니즘을 가리키도록 정정하거나, 예시
    주석을 정규식이 매칭하지 않는 형태(예: 코드블록 밖 산문 설명, 또는 다른 함수명을 예시로
    사용)로 바꿔 자기참조 자체를 없애는 것도 대안. 필수 아님 — 안전망(죽은 항목 캐너리)이
    이미 있어 병합을 막을 사안은 아니다.

## 그 외 확인한 문서화 품질 (발견사항 아님)

- `masked-reject-callers-guard.ts`/`masked-reject-callers.spec.ts` 는 "왜 언급이 아니라
  import 만 보는가", "왜 단어 경계가 필요한가(`resolveTriggerParametersRejectingMasked` 접두
  겹침)", "가드가 자기 결함을 세 번 드러낸 이력" 을 JSDoc/헤더 주석으로 상세히 남겼고, 실측
  (`grep`)으로 `ALLOWED_DIRECT_CALLERS` 의 `hooks.service.ts`/`schedule-runner.service.ts`
  항목이 실제로 base 함수를 import 함을 확인 — 문서와 코드가 일치한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (전체), `.../masked-reject-callers.spec.ts` (전체)
- 형제 가드(`eslint-unicorn-peer-guard.ts`, frontend `typescript-toolchain-guard.ts`)에 대한
  교차 참조가 실재 파일을 정확히 가리킴을 `find` 로 확인.
- CHANGELOG·README·API 문서·설정 문서 관점에서는 이번 라운드가 추가한 것이 순수 내부
  repo-guard 테스트(런타임/사용자 표면 없음)뿐이라 별도 CHANGELOG 항목·README 갱신 필요성은
  없다(이 저장소에 `repo-guards/` 를 카탈로그화하는 SoT 문서 자체가 없음을 `grep` 로 확인 —
  선례와 일치하는 패턴).

## 요약

이번 라운드가 실제로 추가한 신규 코드는 repo-guard 파일 2개뿐이며, 나머지는 앞선 4개
리뷰 라운드가 이미 문서화 관점에서 반복 검증해 NONE/LOW 로 수렴시킨 콘텐츠의 재커밋이다.
신규 가드 파일들은 이 시리즈의 관례대로 근거·이력("가드가 세 번 자기 결함을 드러냈다")을
상세히 남겨 문서화 밀도가 높고, 실측 결과 핵심 설명(허용목록 이유, 접두 겹침 회피 이유)이
코드와 정확히 일치한다. 유일하게 짚을 점은 그 파일 자신이 스스로를 허용목록에 넣은 이유를
설명하는 인라인 주석 한 줄이 실제 매칭 메커니즘(우연한 주석-형태 일치)이 아니라 부정확한
설명("상수/픽스처 보유")을 달고 있다는 것(INFO) — 병합을 막을 사안은 아니며, 이미 존재하는
"죽은 허용목록 항목" 캐너리 테스트가 향후 드리프트를 잡아준다.

## 위험도

NONE
