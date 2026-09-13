# 아키텍처 리뷰 — guide-identifier-existence (2차 라운드, 직전 리뷰 fix 반영 후)

이 세션은 직전 `/ai-review`(`review/code/2026/09/13/14_41_14`, architecture WARNING 2건 포함)와
그 fix 커밋(`69847f45f`) 이후 상태를 다시 본다. 아래는 직접 소스를 열어 확인한 결과다.

## 발견사항

- **[INFO]** 직전 라운드 architecture WARNING 2건 — 실측 확인 결과 **모두 해소됨**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16-17`,
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:48-56`
  - 상세: (1) 자매 파일의 죽은 파일명 참조 — `guide-sanitized-message-parity.test.ts:16` 이
    이제 `guide-identifier-existence.test.ts`(역사 각주 `#1330` 당시 이름 병기)를 가리킨다.
    `grep -rn "guide-error-code" codebase/`로 재확인한 결과 남은 참조는 전부 `#1330`/`#1331`
    각주가 붙은 의도적 역사 서술뿐이다(`guide-identifier-scan.ts:9` 등). (2) compose 파일
    판별이 저장소 루트의 아무 `.yml`/`.yaml`(당시 `pnpm-lock.yaml` 784KB 포함)을 읽던 암묵
    결합이 `/^docker-compose.*\.ya?ml$/` 로 좁혀졌고, 그 이유(구현이 이름·JSDoc 이 약속한
    범위보다 넓었다)가 인접 주석으로 남았다. 두 항목 모두 "인터페이스가 약속한 것보다 구현이
    넓다/좁다" 는 계약 drift 였는데, 지금은 코드와 주석이 일치한다.
  - 제안: 조치 불요 — 확인 완료.

- **[INFO]** `guide-identifier-scan.ts` 가 세 이질적 축(가이드 파싱 정규식 / 큐레이션 외부
  어휘 데이터 / 소스·인프라 두 계열 기준집합 수집기)을 한 파일(214줄)에 계속 누적
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체 — 정규식군
    (`FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK`, 90-113행대), `GUIDE_EXTERNAL_VOCABULARY`
    (122-132행대), `collectSourceTokens`/`collectEnvDeclarations`(162-214행대)
  - 상세: 이번 PR 로 파일이 189→214줄로 더 자랐다(허용목록 은폐-방지 4강제 관련 주석·
    존재/방출 한계 절 복원 포함). 세 축은 변경 사유가 서로 다르다 — 가이드 마크업 형식이
    바뀌면 정규식군이, 소스 트리 레이아웃이 바뀌면 `collectSourceTokens`가, 인프라 설정
    관례가 바뀌면 `collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY`가 바뀐다. 오늘은
    응집도 문제가 되지 않는 규모지만(모두 "식별자 실재성" 이라는 하나의 도메인에 속하고,
    순수 함수형 코어와 테스트 쪽 명령형 셸의 분리는 잘 지켜져 있다), 이 PR 자체가 "축이
    하나 더 필요해졌다"(에러 코드 전용 → 식별자 전반)는 이력을 막 반복했으므로 다음 확장
    (예: URL·포트 같은 새 식별자 종류) 때 재고할 지점이다.
  - 제안: 지금 조치 불요. 허용목록 상한(5)에 근접하거나 축이 4개를 넘으면
    axis-scanning 모듈과 basis-collection 모듈 분리를 검토.

- **[INFO]** 과거 결함 재현 테스트가 삭제된 소스의 정규식 리터럴을 손으로 복제 — 연결이
  git 이력뿐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:179-187`
    (`"[회귀] #1330 의 문맥-게이팅 축이었다면 놓쳤다"`)
  - 상세: `CODE_CONTEXT`·`FIELD_TABLE_NAME` 정규식을 로컬 상수로 재작성해 "옛 축이었다면
    놓쳤다"를 증명한다. 원본 `guide-error-code-scan.ts`는 이 PR에서 완전히 삭제됐으므로,
    이 리터럴이 삭제된 구현과 문자 단위로 같은지 보장하는 것은 이제 git 이력 대조뿐이다
    (자동 링크 없음). 의도(역사적 술어를 회귀 테스트로 고정)는 타당하고 실측 근거(파일
    상단 표)와 함께 있어 위험은 낮다.
  - 제안: 현 상태 유지 가능. 주석에 삭제 커밋 SHA를 박아 두면 향후 대조가 쉬워진다(선택).

- **[INFO]** `collectEnvDeclarations` 기준집합 병합이 오늘 시점 판정을 지탱하지 않음을
  코드·plan·테스트 세 곳이 일관되게 disclose — 설계로서는 건실하나 "죽은 코드처럼 보이는
  살아있는 코드"의 경계 사례
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:175-214`
    (`collectEnvDeclarations` docstring) / `guide-identifier-existence.test.ts:81-93`
    (`"env 선언처 수집기가 살아 있다 (오늘 판정은 지탱하지 않는다)"`)
  - 상세: 뮤테이션 실측으로 "이 함수를 통째로 빼도 스위트는 GREEN"임을 확인했고, 그 사실을
    숨기지 않고 docstring·테스트 이름·plan(§B)에 동일하게 남겼다. floor 테스트가 "수집기가
    조용히 0종을 반환하지 않는다"만 고정하고, env-only 토큰이 인용되기 시작하면(전환 시점)
    baseline 단언이 RED가 되도록 설계했다 — 근거·전환 신호·한계를 모두 코드에 박아 둔
    드문 사례다. 구조적 결함은 아니지만, 이런 "오늘은 무용하나 방어적으로 유지" 코드가
    쌓이면 다음 사람이 각 함수의 "실제 판정 기여도"를 개별 뮤테이션 실측 없이는 알 수
    없다는 유지보수 비용은 남는다.
  - 제안: 조치 불요. 이 파일에 이런 함수가 하나 더 생기면(예: `packages` 기준집합) 파일
    상단에 "판정 기여도 표"를 두는 것을 고려.

## 요약

직전 라운드(architecture WARNING 2건: 자매 파일 죽은 참조, compose 필터 범위 drift)를
소스 직접 대조로 재확인한 결과 **둘 다 해소됐다**. 이번 재설계(`guide-error-code-existence`
폐기 → `guide-identifier-existence`로 대체, 문맥-게이팅 3축 → 백틱 전수 축 + 은폐-방지
4강제 허용목록)는 SOLID·응집도 관점에서 여전히 건실하다 — 순수 스캐너(`guide-identifier-
scan.ts`)와 명령형 셸(테스트 파일의 fs 읽기)의 분리, 축 라벨 재사용 회피, 허용목록이
검증 불가능한 사유("Planned 니까")로 채워지는 것을 막는 4가지 강제 불변식이 특히 눈에
띈다. fix 커밋(`69847f45f`)이 되돌린 comment 복원·filter 축소·명명 회귀 테스트 복원 모두
새로운 구조적 결함을 들이지 않았다. 남은 항목은 전부 INFO — 파일 하나가 세 축을 누적하고
있는 점(오늘은 응집도 문제 없음, 확장 시 재고 지점), 삭제된 원본 정규식의 수작업 복제(git
이력 의존), 그리고 오늘은 판정을 지탱하지 않는 방어적 함수가 남기는 유지보수 비용 —
셋 다 규모가 작고 CRITICAL/WARNING 급 구조 결함이 아니다.

## 위험도

LOW
