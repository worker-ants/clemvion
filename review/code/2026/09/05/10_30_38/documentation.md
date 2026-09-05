# 문서화(Documentation) 리뷰

## 검토 방법

이번 changeset(63개 파일)은 이전 6라운드의 code review(`09_27_04`→`09_42_13`→`10_20_57`)와
5라운드의 consistency-check(`09_13_39`→`09_53_09`→`10_04_12`→`10_13_38`)가 이미 반복적으로
검토·조치한 산출물 다수를 포함한다. 각 라운드의 RESOLUTION 이 "조치 완료"라고 주장하는 내용을
실제 워킹트리 파일(`codebase/backend/migrations/README.md`, `spec/conventions/migrations.md`,
`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`,
`spec/data-flow/8-notifications.md`, `plan/complete/spec-draft-migration-rerun-and-citations.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)을 직접 열어 대조 검증했다.
추가로 `git log`/`git show` 로 최신 커밋(`74d405b07`, 이 리뷰 세션과 같은 분·초에 생성)이
정확히 무엇을 바꿨는지 확인해, 아직 어떤 라운드도 보지 못한 "진짜 신규" 델타를 좁혔다.

검증 결과, 지난 라운드들이 "조치 완료"로 표시한 항목(README §5 두 경로 표, `review-citations.md`
§3 스코프 확장, `spec-impl-evidence.md` §2.1 각주, `8-notifications.md` V056 캐비엇, README 규칙
불릿의 `DO $$ ... $$` 동기화, `migrations.md` 불릿 재배치)은 전부 실제로 반영되어 있음을
확인했다 — 회귀 없음.

## 발견사항

- **[INFO]** 최신 커밋(`74d405b07`, 이 리뷰 세션 직전)이 README §5 안에 **또 다른 이름-기반
  `§` 참조**를 새로 만들었다 — 바로 앞 라운드(`10_04_12` INFO#2)가 지적해 고친 것과 같은 결함
  유형이 같은 편집에서 재발했다
  - 위치: `codebase/backend/migrations/README.md:160` (`| **CREATE 성공 후 2) DROP(old) 이
    실패** → 마이그레이션 전체가 실패로 기록 → \`repair\` + 재실행 | **발생** | 아래
    §checksum 보정 절차가 그 경로다 — "정상 흐름 밖" 이 아닙니다 |`)
  - 상세: `10_04_12` 라운드는 같은 파일의 "그 패턴은 아래 **§인덱스 교체**에 있습니다" 를
    "이 문서가 다른 모든 곳에서 예외 없이 **숫자** 섹션 참조(`§4`, `§5`, `§6`)만 쓰는
    자기-확립 관례에서 벗어난 유일한 사례"라고 지적했고, 그 인용은 `같은 절(§5) 아래
    **인덱스 교체는 DROP-먼저**` 로 정정되어(README.md:127) 지금 워킹트리에 반영돼 있다.
    그런데 바로 다음 커밋(`74d405b07`, "정상 흐름에서는 발생하지 않는다" WARNING 수정)이
    같은 §5 안에 `"아래 §checksum 보정 절차"` 라는 **똑같은 형태의 이름-기반 § 참조**를
    새로 추가했다. `README.md` 전체를 `grep -n "checksum"` 한 결과 "checksum 보정"이라는
    문자열은 §6 안 bash 코드블록의 인라인 주석(`# 1) checksum 보정`, :209)으로만 존재하고,
    그것을 제목으로 삼는 `###`/`####` heading 은 없다 — 즉 "§checksum 보정" 은 앵커가 없는
    이름 참조이며, 직전 라운드가 고친 문제와 문자 그대로 같은 유형(§+이름, 헤딩 아님, 앵커
    없음)이 같은 세션 안에서 재발했다.
  - 제안: `10_04_12` 가 "§인덱스 교체" 에 적용한 것과 같은 처방을 적용한다 — 예를 들어
    "아래 **§6** 의 checksum 보정 절차가 그 경로다"(README 의 실제 `### 6.` 번호 참조) 또는
    "아래 `docker compose up migrate-repair` 절차가 그 경로다"(구체적 명령 인용)로 바꿔
    숫자-전용 `§<번호>` 관례에 맞춘다. 렌더링이나 가드에는 영향 없는 가독성 수준이지만, 같은
    결함이 한 PR 안에서 두 번째로 나타난 것이므로 "이 자리를 고쳤다"는 안심이 다른 곳의
    같은 패턴까지 훑었다는 보장은 아니라는 신호로 기록해 둔다.

- **[INFO]** (확인만, 조치 불요) `code:` frontmatter 준수 예시가 가리키는 두 인용 중 하나
  (`sanitize-loader-error.ts` → `review/code/2026/05/26/12_10_38`)는 **워킹트리에 실제로 없는
  디렉터리**를 가리킨다
  - 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts:17` (인용) ↔
    `spec/conventions/review-citations.md` frontmatter `code:` (이 파일을 "준수 예시"로 지목)
  - 상세: `ls review/code/2026/05/26/` 로 직접 확인한 결과 해당 디렉터리는 없고, `git log
    --all -- review/code/2026/05/26/12_10_38` 은 `f7c56bf0a`(삭제 커밋) 한 건만 나온다. 다만
    이는 새 결함이 아니다 — `review-citations.md` §1 자신이 "전체 경로 인용 중 1건이
    워킹트리에 없다"고 이미 이 정확한 경로를 실측·명시하고 있고, 여러 라운드(`09_42_13`
    requirement 리뷰 포함)가 독립적으로 재현해 일치를 확인한 바 있다. §1 의 논지(경로 인용은
    git 이력으로 해소되지만 bare 인용은 안 된다)와도 모순되지 않는다. 새 지적이 아니라
    참고용으로만 남긴다.

## 요약

이번 changeset 은 마이그레이션 재실행 안전성 패턴과 리뷰 인용 규약을 성문화하는 순수
문서/spec/plan PR로, 11라운드(code review 6 + consistency-check 5)에 걸쳐 반복적으로 검토·조치된
끝에 대부분 수렴해 있다. 직접 대조한 결과 과거 라운드가 "조치 완료"로 표시한 항목은 전부 실제로
반영돼 있고 회귀는 없었다. 다만 가장 최근 커밋(`74d405b07`, 이 리뷰 세션과 거의 동시에 생성되어
어떤 이전 라운드도 아직 보지 못한 델타)이 직전 라운드가 고친 것과 **똑같은 유형의 결함**("§ +
이름, 헤딩 아님, 앵커 없음")을 같은 파일 안 다른 자리에 새로 만들었다 — README.md:160 의
"§checksum 보정". CRITICAL/WARNING 급은 없으며, 이 INFO 를 제외하면 새로 지적할 문서화 결함을
찾지 못했다.

## 위험도
LOW
