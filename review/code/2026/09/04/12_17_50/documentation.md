# 문서화(Documentation) 리뷰 — Swagger DTO 계약 정합화 배치 (누적 diff, 3R)

## 검토 범위 메모

이 diff(`origin/main...HEAD`, 커밋 10개)는 원 수정(`fefec2b27`, Swagger DTO nullable/presence
9곳 + 신규 가드) 이후 두 차례 코드 리뷰(`11_02_30`, `11_44_16`)와 한 차례 consistency 검토
(`11_33_21`)가 이미 문서화 관점을 포함해 훑었고, 그 세 세션이 지적한 CHANGELOG 누락(1R
WARNING)·경로 정규화 복제(2R WARNING, 문서화 관점 아님이지만 이번 라운드에서 관련 docstring
품질 재확인)·stale plan 경로 주석(consistency WARNING)이 실제로 어떻게 반영됐는지를 소스를
직접 `Read`로 열어 대조했다. 아래는 그 결과이며, 이전 두 라운드에서 이미 INFO로 분류돼
비차단 판정을 받은 항목은 이번에도 같은 위치에서 재확인만 하고 새로 발견된 것과 구분해 적는다.

## 발견사항

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 설명이 여전히 명시적 `null` 케이스를
  언급하지 않는다 — 1R·2R documentation 리뷰에서 이미 지적됐고 이번(3R)에도 그대로 남아 있다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:13`
    (`description: '사용할 LLM Config UUID. 생략 시 워크스페이스 기본값 사용'`) — 게이트 19
    (`llmConfigId?: string | null;`)만 타입이 넓어졌고 설명 문구는 이번 diff 대상이 아니다.
  - 상세: 타입은 `string` → `string | null` 로 넓어졌는데 설명은 "생략 시"만 언급한다.
    자매 DTO `update-assistant-session.dto.ts:19`는 같은 필드를 "null 전달 시 workspace
    default로 폴백"이라고 명시적으로 적어 대조된다. 서비스 코드(`workflow-assistant-session.
    service.ts` `dto.llmConfigId ?? null`)가 생략과 명시적 `null`을 동등하게 처리하므로 설명이
    틀린 것은 아니지만, 두 라운드 연속으로 "급하지 않음"으로 defer된 채 세 번째 라운드에도
    조치되지 않았다는 사실 자체는 기록해 둔다.
  - 제안: 여전히 급하지 않음(WARNING 승격 사유 아님). 다음에 이 파일을 편집할 기회가 있으면
    `update-assistant-session.dto.ts` 문구를 그대로 가져와 통일할 것.

- **[INFO]** `nullable-type-lie-cast.spec.ts`의 "모듈 스코프" 인라인 주석이 여전히 옛 표현을
  유지한다 — 1R·2R에서 이미 지적됐고 3R에도 그대로다 (이번 라운드 커밋 `edae7544f`이 바로 위
  함수 정의(게이트 47-56)를 다시 손댔음에도 이 주석(게이트 124)은 diff hunk 밖이라 미수정)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:124`
    (`// 구현은 모듈 스코프의 \`withFiles\` — 단일 파일 호출은 그 얇은 래퍼다.`)
  - 상세: 바로 위 JSDoc(게이트 46-53)은 `withFixture`가 이제
    `sharedWithFixture(content, fn, 'probe.entity.ts')`로 공유 헬퍼에 위임한다고 정확히
    설명하는데(이번 3R 커밋이 실제로 그렇게 고쳤다 — W1 조치 확인), 124번째 줄 주석은 여전히
    "모듈 스코프의 `withFiles`"라고 적어 로컬 함수라는 인상을 준다. 틀린 문장은 아니지만(import
    바인딩도 모듈 스코프 식별자) 위 JSDoc과 어휘가 어긋난 채 세 번째 라운드째 남아 있다.
  - 제안: 여전히 사소함. "// 구현은 공유 헬퍼의 `withFiles`(import)"로 한 단어만 바꾸면 위
    JSDoc과 일치한다.

- **[INFO]** 관측된 이상 상태 — 리뷰 대상이 아닌 파일이 워킹트리에서 미커밋 상태로 수정돼 있음
  (내 뮤테이션 아님, 1R·2R 리뷰 세션에서도 동일하게 관측·보고된 것과 같은 파일)
  - 위치: `review/consistency/2026/09/04/11_33_21/SUMMARY.md` — `git status --short` 결과 `M`.
  - 상세: 이번 리뷰는 전 과정에서 `Read`/`Bash`(읽기 전용 `grep`/`find`)만 사용했고 어떤 파일도
    `Write`/편집하지 않았다. 이 파일은 프롬프트에 실린 diff(파일 46, 커밋된 버전 — "# Consistency
    SUMMARY — `--impl-done spec/5-system/`" 제목)와 다른, 더 상세한 포맷("# Consistency Check
    통합 보고서" 제목 + 표 형식)으로 로컬에서 바뀌어 있다. 2R documentation 리뷰(`11_44_16/
    documentation.md`)가 이미 같은 파일·같은 현상을 "병렬로 도는 다른 프로세스의 흔적일 가능성이
    높다"고 보고했는데, 3R(이번 세션)에도 원복되지 않고 그대로 남아 있다 — 즉 이 미커밋 변경은
    적어도 두 리뷰 라운드에 걸쳐 지속되고 있다. 확인·원복은 이 리뷰의 권한/스코프 밖이라 사실만
    보고한다.
  - 제안: 이 세션을 운영하는 오케스트레이터 쪽에서 이 파일의 최종 의도된 내용(committed 버전 vs
    워킹트리 버전 중 어느 쪽이 맞는지)을 확인하고 정리할 것을 권장. 코드 리뷰 대상 diff 자체와는
    무관하다.

## 긍정 관찰 (이전 라운드 WARNING 조치 검증 — 발견사항 아님)

- **2R WARNING(W1~W3, `edae7544f`) 전부 정확히 조치됨을 소스 직접 대조로 확인**:
  - W1(JSDoc "얇은 래퍼" 서술과 구현 불일치) — `nullable-type-lie-cast.spec.ts:54-56`의
    `withFixture`가 실제로 `sharedWithFixture(content, fn, 'probe.entity.ts')`에 위임하도록
    바뀌어 서술과 구현이 일치한다.
  - W2(경로 정규화 8곳 중복) — `source-scan.ts`에 `toPosixPath`/`toPosixRelative`를 추출하고
    (게이트 276-306, JSDoc이 "같은 한 줄이 여덟 군데 복제돼 있었다"는 실측과 그중 4곳을 직전
    라운드 자신이 늘렸다는 자기반증까지 명시), 8곳 전부(`masked-reject-callers-guard.ts`,
    `nullable-type-lie-cast-guard.ts` 3함수, `production-build-devdep-guard.ts`,
    `production-build-devdep.spec.ts`, `swagger-dto-contract-guard.ts`)가 그 함수를 호출하도록
    통일됐다.
  - W3(정규화 로직 테스트 부재) — `source-scan.spec.ts`에 `toPosixPath`/`toPosixRelative`
    전용 `describe` 블록이 신설됐고(게이트 339-370), JSDoc이 "50개 spec 전부 GREEN이었던"
    최초 뮤테이션 실측과 "한 번 더 틀렸다"(POSIX `path.relative`가 윈도우 경로를 모르는 문제)는
    2차 시행착오를 투명하게 기록했다.
- **CHANGELOG.md 신규 항목(1R WARNING 조치)이 자매 항목과 동일 포맷 유지**: "종전/지금" 표,
  "영향" 절이 8필드(요구 방향 반전)와 `llmConfigId`(반대 방향, OpenAPI 출력 불변)를 명확히
  구분해 3라운드에 걸쳐 그대로 정확하다.
- **plan 문서(`spec-draft-nullable-notation-followups.md`)의 자기수정 이력이 투명함**: "이 표를
  두 번 틀렸다"(70→102→103)는 서술과, 같은 PR 안에서 실측치(103/17/8/1)가 계약 거짓 9곳 수정
  직후 곧바로 낡는다는 사실(104/25/0/1)까지 명시하고, `grep`으로 재확인한 결과 문서 전체에서
  옛 수치("101 vs 18", "109곳" 등)가 서사적 인용 외에 잔존 사용되는 곳이 없음을 확인했다 —
  숫자 정합성이 3라운드 누적 편집에도 깨지지 않았다.
- **신규 가드 2개(`swagger-dto-contract-guard.ts`/`.spec.ts`)의 JSDoc 품질**: 정규식이 세 번
  틀린 구체적 형태(객체 리터럴 안의 `;`, 화살표 함수의 `)`, 데코레이터 이름으로 `required`
  오추론)를 각각 대조군 테스트로 1:1 캐너리화했고, `effectiveRequired`가 `@nestjs/swagger`
  비공개 구현에 결합돼 있다는 사실을 캐너리 테스트(`[캐너리] @nestjs/swagger 별칭 가정이
  살아있는가`)와 그 이유를 설명하는 JSDoc으로 함께 고정했다(1R architecture WARNING 조치 확인).
- **plan 경로 stale 주석(consistency W1) 조치가 3라운드 누적 diff에서도 정확히 유지됨**:
  `source-scan.ts:190-193`·`nullable-type-lie-cast.spec.ts:22-25` 양쪽 모두
  `plan/complete/entity-nullable-column-type-mismatch.md`(완료 이력)와
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(다음 배치, "§5.4 drift 배치")를
  정확히 가리킨다.

## 요약

3라운드째 누적된 이 diff는 documentation 관점에서 CRITICAL/WARNING 급 결함이 없다. 1R이 지적한
CHANGELOG 누락과 consistency 라운드가 지적한 stale plan 참조·§5.4 스코프 오인용은 모두 정확히
조치돼 이번 3R에서도 유지됨을 재확인했고, 2R이 지적한 경로 정규화 중복·JSDoc-구현 불일치도
이번 최신 커밋(`edae7544f`)에서 추출·위임·테스트 신설로 정확히 해소됐다. 남은 것은 두 라운드
연속으로 "급하지 않음"으로 defer된 INFO 2건(`llmConfigId` 설명 문구, "모듈 스코프" 주석 어휘)
뿐이고 둘 다 세 번째 라운드에도 성격이 변하지 않아 수렴 신호로 본다. 추가로, 이 리뷰가 만들지
않은 워킹트리 이상 상태(`review/consistency/2026/09/04/11_33_21/SUMMARY.md`의 미커밋 수정)가
최소 두 라운드에 걸쳐 지속되고 있음을 관측한 그대로 보고한다 — 코드 리뷰 대상 diff 자체의
결함은 아니다.

## 위험도

LOW
