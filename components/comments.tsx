'use client'

import Giscus from '@giscus/react'

export function Comments() {
  return (
    <div className="mt-16">
      <h2 className="mb-8 text-2xl font-bold">Comentários</h2>

      <Giscus
        repo="gasparzeon/gasparz1"
        repoId="COLE_SEU_REPO_ID"
        category="General"
        categoryId="COLE_SEU_CATEGORY_ID"
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme="preferred_color_scheme"
        lang="pt"
        loading="lazy"
      />
    </div>
  )
}