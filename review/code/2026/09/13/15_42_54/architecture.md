# 아키텍처 리뷰 — guide-identifier-existence (라운드 3, 누적 fix 반영 후)

이 세션은 직전 두 라운드(`review/code/2026/09/13/14_41_14`, `15_03_06`)에서 나온
architecture WARNING 2건 + INFO 다수를 그 fix 커밋들(`69847f45f` → `93806013` →
`b75fe0ace`) 반영 후 다시 소스를 직접 열어 확인한 결과다. `git diff --stat
origin/main...HEAD -- codebase/ CHANGELOG.md PROJECT.md plan/` 로 실 코드 변경분을
`guide-identifier-existence.test.ts`(316줄, 신규) / `guide-identifier-scan.ts`(214줄,
신규) / `guide-error-code-existence.test.ts`·`guide-error-code-scan.ts`(삭제) /
`guide-sanitized-message-parity.test.ts`(주석 2줄) 로 확정하고 전량을 읽었다.

## 발견사항

- **[INFO]** 직전 두 라운드의 architecture WARNING 2건 — 재확인 결과 모두 해소 유지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
    (자매 파일 크로스레퍼런스), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58`
    (`composeTexts` 필터)
  - 상세: (1) sibling 참조는 `guide-identifier-existence.test.ts`(`#1330` 당시 이름 병기)로
    갱신돼 있다. (2) `composeTexts` 필터는 `/^docker-compose.*\.ya?ml$/` 로 좁혀져 저장소
    루트의 무관 YAML(`pnpm-lock.yaml` 등)을 더 이상 암묵적으로 끌어들이지 않으며, "구현이
    이름·JSDoc 이 약속한 범위보다 넓었다"는 경위가 인접 주석으로 남아 있다. 둘 다 라운드 1이
    지적한 "인터페이스 계약과 구현의 실제 범위가 어긋난다" 는 형태의 재발이 없다.
  - 제안: 조치 불요.

- **[INFO]** `guide-identifier-scan.ts` 가 여전히 세 이질적 책임(가이드 파싱 정규식군 /
  큐레이션 외부 어휘 데이터 / 소스·인프라 두 계열 기준집합 수집기)을 한 파일(214줄)에
  누적 — 오늘은 응집도 문제 없음, 다음 확장 시 재고 지점
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체 —
    정규식군(`FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK`, 90-113행) ·
    `GUIDE_EXTERNAL_VOCABULARY`(122-132행) · `collectSourceTokens`/`collectEnvDeclarations`
    (162-214행)
  - 상세: 세 축은 변경 사유가 서로 다르다 — 가이드 마크업 형식이 바뀌면 정규식군이,
    소스 트리 레이아웃이 바뀌면 `collectSourceTokens` 가, 인프라 설정 관례가 바뀌면
    `collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY` 가 바뀐다. 다만 이 파일은
    외부 의존성이 0(`import` 없음, 순수 함수만 export)이라 결합도는 오히려 낮고, 세 축
    모두 "가이드 식별자 실재성" 이라는 단일 도메인에 속해 SRP 위반이라기보다는 응집된
    하나의 모듈에 가깝다. `GUIDE_EXTERNAL_VOCABULARY` 상한(5, 테스트가 강제)이 지켜지고
    축이 3개에서 멈추는 한 분리 압력은 낮다.
  - 제안: 지금 조치 불요. 축이 4개를 넘거나 허용목록이 상한에 근접하면
    axis-scanning 모듈과 basis-collection 모듈 분리를 검토(라운드 1·2와 동일 권고 유지).

- **[INFO]** 확장점 설계(OCP) — `GUIDE_EXTERNAL_VOCABULARY` 는 데이터 추가만으로 확장되고,
  네 가지 테스트 불변식이 그 데이터가 은폐 수단으로 오용되는 것을 구조적으로 막는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:122-132`
    (선언), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:131-156`
    (4강제: 사유 명시 · 상한 · 인용 유지 · 기준집합 배제)
  - 상세: 판정 핵심 로직(`scanIdentifierCitations`)을 수정하지 않고도 허용목록 항목
    추가만으로 새 외부 어휘를 반영할 수 있는 구조는 개방-폐쇄 원칙에 부합한다. 그리고 그
    확장점이 무제한 성장하거나("Planned 니까" 류 검증 불가능한 사유로 채워지는 것)을
    테스트가 구조적으로 막는 설계는(상한 + 기준집합 배제 + 인용 유지 단언) 이 저장소가
    반복적으로 겪은 "허용목록이 결함을 가리는 은폐 수단이 된다" 클래스에 대한 선제 방어로
    평가할 만하다.
  - 제안: 없음(긍정 관찰).

- **[INFO]** 과거 결함 재현 테스트가 삭제된 구현(`guide-error-code-scan.ts`)의 정규식
  리터럴을 손으로 복제 — 연결이 git 이력뿐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:182-190`
    (`"[회귀] #1330 의 문맥-게이팅 축이었다면 놓쳤다"` 내부 `CODE_CONTEXT`/`FIELD_TABLE_NAME`)
  - 상세: 라운드 1·2와 동일한 관찰이 이번 최종 상태에도 유지된다 — 원본이 완전히
    삭제됐으므로 이 리터럴이 삭제 시점 구현과 문자 단위로 같은지는 이제 git 이력 대조로만
    확인 가능하고 자동 링크가 없다. 위험은 낮다(실측 근거표가 파일 상단에 병존).
  - 제안: 현행 유지 가능. 주석에 삭제 커밋 SHA를 박으면 향후 대조 비용이 준다(선택).

- **[INFO]** 레이어 책임(프레젠테이션/비즈니스/데이터) 관점은 이 diff 에 적용 대상 없음
  - 상세: 이번 변경은 애플리케이션 3계층 어디에도 속하지 않는 CI/vitest 시점 정적 문서
    검증 테스트다. `frontend` 소스를 기준집합에 넣지 않기로 한 결정(`guide-identifier-
    existence.test.ts:43-44` 주석 — "넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로
    자기를 증명한다")은 오히려 "가이드 ↔ backend/packages 소스" 라는 검증 방향이 자기
    순환(self-fulfilling)에 빠지지 않도록 막는 건실한 경계 설정이다.
  - 제안: 없음.

## 순환 의존성 / 모듈 경계

`guide-identifier-scan.ts` 는 외부 import 가 전혀 없는 순수 함수 모듈이고, 테스트 파일만
그것과 `tree-walk`/`impl-anchor-parse` 를 조합한다 — 순환 가능성 없음. frontend 테스트가
backend 소스를 **텍스트로만** 읽고 import 하지 않는 관례(`guide-sanitized-message-parity.
test.ts` 주석에 근거 명시: "패키지 경계를 넘는 빌드 의존 방지")가 이 파일에도 일관되게
적용돼 패키지 경계를 넘는 컴파일-타임 결합이 없다.

## 요약

라운드 1·2에서 지적한 architecture WARNING 2건(자매 모듈 크로스레퍼런스 drift, compose
필터 범위가 이름/JSDoc 약속보다 넓었던 계약 drift)은 최종 상태(`b75fe0ace`)에서 모두
해소가 유지되고 있다. 이번 재설계(`guide-error-code-existence` 폐기 → `guide-identifier-
existence` 대체, 문맥-게이팅 3축 → 백틱 전수 축 + 은폐-방지 4강제 허용목록)는 SOLID·
결합도/응집도 관점에서 건실하다 — 순수 함수 코어(0 외부 의존)와 명령형 셸(테스트의 fs
읽기)의 분리, 데이터 기반 확장점(OCP)과 그 오용을 막는 4가지 불변식, frontend/backend
패키지 경계를 넘지 않는 텍스트 기반 검증 관례가 특히 눈에 띈다. 남은 항목은 전부 INFO
수준 관찰이며 규모가 작다 — 한 파일이 세 이질적 축을 누적 중인 점(오늘은 응집도 문제
없음)과 삭제된 원본 정규식의 수작업 복제(git 이력 의존)로, 둘 다 CRITICAL/WARNING 급
구조 결함이 아니고 라운드 1·2와 동일한 낮은 우선순위 권고에 머문다.

## 위험도

LOW
