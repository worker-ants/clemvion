# 문서화(Documentation) Review — masked-marker-contract-7d2e14 (라운드 6, 13_55_59)

## 검토 범위

이번 라운드는 직전 라운드(`13_34_34`)가 지적한 WARNING("규칙 문단이 frontend spec 에만
있고 backend spec 에는 없다")을 고친 수정 커밋(`0e7b6fd4c`, "비대칭을 경고하는 문단을
한쪽에만 넣었다 — 라운드6 처분")을 포함한 누적 diff를 대상으로 한다. 그 수정 커밋 자체가
새로 만든 흠이 있는지를 중심으로 backend/frontend 가드 4파일(`masked-marker-mirror-guard.ts`
×2, `masked-marker-mirror.spec.ts`/`.test.ts` ×2)의 JSDoc 헤더를 `Read`로 직접 열어 좌우
대조했고, `plan/in-progress/masked-marker-shared-package.md`의 체크박스 상태, `spec/5-system/
14-external-interaction-api.md` R17의 SoT 서술, 신규 패키지 `README.md`/`index.ts`의
JSDoc도 재확인했다.

## 발견사항

- **[WARNING]** 직전 라운드의 "규칙" 문단 이식 수정이 backend spec 파일에서 **문장을
  통째로 옮기지 못하고 원본 문장 조각을 규칙 문단 뒤에 그대로 남겨**, 이제 그 JSDoc 블록이
  "탐지 로직 중복은 조건부로만 안전하다"고 말한 직후 같은 인용구(`>`) 안에서 조건 없이
  "무력화하지 않는다"를 반복하는 자기모순 문장 + 깨진 blockquote 마크업 + 파일 내 최장
  줄(약 1.9배)을 만들었다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:36-37`
    (`describe` 블록 바로 위 JSDoc 헤더 마지막 두 줄)
  - 상세: 커밋 `0e7b6fd4c`의 diff를 직접 대조했다. 수정 전(라운드5 처분, `10fcc43e2`) 원문은
    `... 바뀌든 최소 하나는 실행된다. 값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도
    반대쪽 트리거를 무력화하지 않는다**:` 로 끝나고 다음 줄 `한 사본이 낡아도 다른 사본이
    같은 불변식을 자기 트리거에서 계속 지킨다.` 로 이어지는 **한 문장**이었다. 라운드6
    수정은 이 문장을 앞부분(`... 최소 하나는 실행된다.`)만 남기고 새 "다만 그 안전은
    조건부다 / 규칙: ..." 문단을 그 자리에 삽입했는데, **떼어냈어야 할 뒷부분("값의 미러와
    달리 탐지 로직의 중복은 ... 무력화하지 않는다: 한 사본이 낡아도...")을 지우지 않고
    새로 추가한 "규칙" 줄 끝에 그대로 이어 붙였다.** 그 결과 현재 소스(line 36)는
    `> **규칙**: 판정 분기를 새로 넣거나 고칠 때는 **양쪽에 대칭 캐너리를 함께** 넣는다.
    값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지
    않는다**:` 로 끝나고(241자 — 파일 내 다음으로 긴 줄의 약 1.9배, 직전 라운드가 INFO로
    지적했던 168바이트 줄보다 더 길어졌다), line 37 `한 사본이 낡아도 다른 사본이 같은
    불변식을 자기 트리거에서 계속 지킨다.` 은 `*` 만 있고 `>` blockquote 마커가 없어
    앞줄들과 markdown 인용 구조가 깨진다. 의미상으로도 문제다 — 바로 위 문단이 "**다만 그
    안전은 조건부다**"(라운드3에서 backend만 고치고 "양쪽 다 고쳤다"고 적은 반증 사례를
    들며)라고 명시적으로 조건을 건 직후, 같은 인용 블록 안에서 다시 조건 없는 절대형
    "무력화하지 않는다"를 되풀이하는 형태가 되어 이 문서 자신이 경계하는 "완료형/절대
    서술이 반증됐는데도 소스에 남는다"는 바로 그 실패 패턴(라운드5 WARNING의 핵심 지적)을
    변형된 형태로 재현한다. frontend 쌍둥이(`masked-marker-mirror.test.ts:26-29`)는 같은
    문장("값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지
    않는다** — 각 사본이 자기 워크플로에서 같은 불변식을 계속 지킨다.")을 "규칙" 문단
    **앞**의 원래 자리에 정확히 한 번만 두고 있고, "규칙" 인용구는 "... 넣는다."로 깔끔하게
    끝난다 — 이번 결함은 backend 사본에만 있다(대칭성 문제는 아니고, backend 사본 자체의
    편집 실수).
  - 제안: backend `masked-marker-mirror.spec.ts:36`의 "규칙" 문장을 `... 넣는다.` 에서
    끝내고, 뒤에 이어 붙은 "값의 미러와 달리 탐지 로직의 중복은 ... 무력화하지 않는다:
    한 사본이 낡아도 다른 사본이 같은 불변식을 자기 트리거에서 계속 지킨다." 는 frontend와
    동일하게 위쪽 "두 스택이 각자 자기 워크플로에서 도는 사본을 갖고 둘 다 저장소 전체를
    훑는다 — 어느 쪽이 바뀌든 최소 하나는 실행된다." 문장 뒤(line 29 부근)로 옮기거나,
    이미 그 취지가 문서 앞부분에 함축돼 있다면 완전히 제거한다. "고쳤다"고 쓰기 전에
    `git diff`로 문장이 실제로 이동했는지(복제/잔존이 없는지) 확인하는 것이 이 PR이 직접
    학습한 교훈(라운드4 RESOLUTION: "고쳤다를 쓰기 전에 세는 것")과 정확히 같은 처방이다.

## 그 외 확인한 항목 (문제 없음)

- `plan/in-progress/masked-marker-shared-package.md:127`의 "spec R17 정정" 체크박스는
  `[x]`로 표시돼 있고, 실제로 `spec/5-system/14-external-interaction-api.md:1625-1627`이
  "SoT 는 공유 패키지 `@workflow/masked-markers`"로 정확히 갱신돼 있어 체크박스=실제
  상태 원칙을 지킨다(직전 라운드 WARNING의 재발 없음).
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`와
  `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`의 헤더
  주석은 좌우 대조 결과 내용·구조 모두 대칭이며 규칙 문단도 양쪽에 정확히 존재한다 —
  이번 결함은 `.spec.ts`/`.test.ts` 짝에서만 발생했고 `-guard.ts` 짝에는 없다.
  `frontend/.../masked-marker-mirror-guard.ts` 헤더도 "판정 분기를 새로 넣거나 고칠 때는
  backend 쌍둥이와 함께 고치고 대칭 캐너리를 넣는다"는 동일 규칙을 명시한다.
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`의 `MAX_REDACT_DEPTH`
  JSDoc은 `@workflow/masked-markers`를 SoT로 정확히 가리키고, `sanitizePayloadForWs`의
  `MAX_SANITIZE_DEPTH`와 별개 불변식임을 명시해 오래된 주석·stale 참조가 없다.
  `codebase/packages/masked-markers/README.md`/`src/index.ts`의 JSDoc도 목적·이관 배경·
  깊이 계약·"리터럴이 같다고 계약이 같지 않다"는 경계까지 정확하고 서로 일치한다.
- `.claude/test-stages.sh`(INTERNAL_PACKAGES)·`packages-checks.yml`(pathspec/matrix/주석
  "5개→6개" 갱신)·`frontend-checks.yml`(신규 `codebase/channel-web-chat/**` 트리거 추가
  근거 주석)·양쪽 `Dockerfile`/`Dockerfile.playwright-e2e`의 COPY 추가 및 인접 주석은
  전부 실제 등록 내용과 일치하며 오래된 주석이 없다.
- 새 공유 패키지에 README·소스 JSDoc이 모두 있고, 소비처(backend/frontend)는 재export로
  기존 import 경로를 유지해 별도 마이그레이션 가이드나 예제 코드 추가 필요성은 없다.
  CHANGELOG 미기재는 형제 패키지(`@workflow/ai-end-reason` 등) 선례와 일치해 이 저장소의
  기존 관행이며, 이전 4개 라운드가 이미 "조치 불요"로 일관되게 판정한 항목이라 재론하지
  않는다.

## 요약

이번 라운드가 검토한 수정 커밋(`0e7b6fd4c`)은 직전 라운드가 지적한 "규칙 문단이 한쪽
spec 파일에만 있다"는 비대칭은 정확히 해소했고 plan 체크박스·spec R17 서술도 여전히
정합하다. 다만 그 수정 자체가 backend `masked-marker-mirror.spec.ts`에서 문장 하나를
완전히 옮기지 못해, 새로 삽입한 "규칙" 문단 끝에 원래 문장의 뒷부분이 그대로 눌어붙는
편집 잔존물을 남겼다 — 결과적으로 "탐지 로직 중복은 조건부로만 안전하다"고 명시적으로
경계를 그은 바로 다음 순간 같은 인용 블록 안에서 조건 없는 절대형 문장을 다시 진술하는
자기모순 + 깨진 blockquote 마크업 + 파일 내 최장(241자, 다음으로 긴 줄의 약 1.9배) 줄을
만들었다. 코드 동작에는 영향이 없고 frontend 쌍둥이 파일은 이 결함이 없어 국소적이지만,
이 PR이 여섯 라운드 내내 스스로 경계해 온 "완료형/절대 서술이 반증되는데도 소스에 남는다"
패턴이 형태를 바꿔 다시 나타난 것이라 WARNING으로 판정한다.

## 위험도
LOW
