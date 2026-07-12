# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** CHANGELOG.md 미갱신 (repo 관례상 문제 없음)
  - 위치: `CHANGELOG.md`
  - 상세: 이번 커밋(`perf(backend): 프로덕션 Docker 이미지 devDeps 제거`)은 이미지 크기 1.4GB→1.23GB 감소를 가져오는 의미 있는 빌드 변경이지만 `CHANGELOG.md` 에 항목이 없다. 다만 저장소 관례를 확인한 결과 `CHANGELOG.md` 는 spec-linked 제품/동작 변경(기능·breaking change)만 기록하고, 선행 npm→pnpm 워크스페이스 전환 커밋(`4dfd59e8c`, 훨씬 큰 변경)조차 CHANGELOG 항목이 없다. 즉 빌드/인프라 최적화는 이 저장소에서 CHANGELOG 대상이 아닌 것으로 보이며, 대신 `plan/in-progress/pnpm-migration-followups.md` §1 에 완료 기록(검증 수치 포함)이 남아 SoT 역할을 한다.
  - 제안: 현행 관례를 따른다면 조치 불필요. 다만 이후 이 정책이 실제 의도인지(빌드/인프라 변경은 CHANGELOG 제외) 팀 컨벤션 문서에 명시할 가치는 있음(선택 사항).

- **[INFO]** 과거 완료 plan 문서의 서술이 현재 Dockerfile 구조와 어긋남 (본 diff 범위 밖, 사전 존재하던 staleness)
  - 위치: `plan/complete/deps-security-hygiene.md:17`, `plan/complete/refactor/07-dependency.md:11`
  - 상세: "`npm prune --omit=dev`(Dockerfile) 후엔 `@nestjs/jwt` 의 전이 설치본에 우연히 기댄 fragile 상태" 라는 서술이 남아있다. 그러나 npm→pnpm 전환(`4dfd59e8c`) 이후 Dockerfile 은 `npm prune --omit=dev` 를 쓰지 않았고(당시 runner 는 devDeps 포함 통째 COPY), 이번 커밋으로 다시 `pnpm install --prod --frozen-lockfile` 로 prod 재해소 방식이 도입됐다. 즉 이 완료 plan 의 "Dockerfile" 괄호 서술은 현재(그리고 지난 몇 커밋 동안) 사실과 일치하지 않는다.
  - 제안: 본 diff 의 변경 대상이 아니고 완료·아카이브 성격 문서라 소급 수정 의무는 없음(CLAUDE.md 상 "1회성·역사 문서"). 참고용으로만 남김 — 향후 devDeps 관련 회귀 조사 시 이 서술을 최신 사실(pnpm install --prod 방식)로 오인하지 않도록 유의.

- **[INFO]** `plan/in-progress/pnpm-migration-followups.md` §1 완료 기록의 PR 참조가 브랜치/작업명 placeholder
  - 위치: `plan/in-progress/pnpm-migration-followups.md:158` — `**완료(2026-07-12, PR pnpm-migration-followups)**`
  - 상세: 다른 완료 항목들(§2 조사 노트 등, 그리고 CHANGELOG 의 다른 항목들)은 통상 실제 GitHub PR 번호(`#916`, `#937` 등)를 참조하는 관례인데, 이 항목은 아직 PR 번호가 없어(로컬 브랜치 상태, origin 미푸시) 작업명을 대신 썼다. 의도된 임시 표기로 보이며 오류는 아님.
  - 제안: PR 생성 후 번호로 교체하면 다른 완료 항목들과 표기 일관성이 맞음(선택 사항, 낮은 우선순위).

## 인라인 주석 품질 평가 (Dockerfile)

신규 `prod-deps` 스테이지 및 갱신된 `runner` 스테이지 주석은 상세하고 정확함:
- WHY 설명 충실 — `pnpm install --prod` 가 node_modules 를 재구성하는 이유, native 모듈/`prepare`(tsc) 재실행이 필요한 이유, 빌드 툴체인이 `deps` 스테이지에만 있다는 사실, `CI=true` 를 준 이유(비대화형 confirm 프롬프트 회피), `dist` 가 node_modules 밖에 있어 보존된다는 사실 — 모두 실제 Dockerfile 구조(`apk add python3 make g++`는 `deps` 스테이지, `dist` 는 `COPY codebase/backend ./codebase/backend` 로 builder 단계 산출물, prod-deps 는 `FROM builder`)와 정확히 일치함.
- `runner` 스테이지 주석도 `COPY --from=prod-deps` 로 바뀐 소스를 정확히 반영하고 있고, "devDeps 까지 포함(이미지 크기 최적화는 후속 과제)" 라는 옛 TODO 성격 주석이 이번 구현으로 해소되어 자연스럽게 대체됨(오래된 주석 잔존 없음).
- README(`codebase/backend/README.md` §Docker, 루트 `README.md` §Docker/Kubernetes 배포)는 스테이지 내부 구조를 서술하지 않으므로 이번 변경으로 stale 해지는 부분 없음. spec/ 하위에도 Dockerfile 스테이지 구성을 규정하는 문서가 없어 갱신 대상 없음.

## 요약

이번 변경은 백엔드 프로덕션 Docker 이미지에서 devDependencies 를 제거하는 인프라 최적화이며, Dockerfile 인라인 주석이 WHY 중심으로 충실히 작성되어 코드와 정확히 일치한다. `plan/in-progress/pnpm-migration-followups.md` 의 완료 기록도 검증 수치(이미지 크기, e2e 결과)를 포함해 SoT 역할을 충분히 한다. README/spec 어디에도 이번 변경으로 stale 해지는 서술이 없고, CHANGELOG 미갱신도 저장소의 기존 관례(빌드/인프라성 변경은 CHANGELOG 비대상)와 일치한다. 발견된 사항은 모두 INFO 수준이며 그 중 하나(`plan/complete/deps-security-hygiene.md` 의 오래된 "npm prune" 서술)는 본 diff 범위 밖의 사전 존재 staleness로 조치 의무가 없다. 전반적으로 문서화 품질은 양호함.

## 위험도

NONE
